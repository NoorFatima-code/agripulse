"""
AgriPulse FastAPI Backend
=========================
Algorithms implemented:
  1. Greedy Water Scheduling  -- O(n log n) sort by ascending moisture
  2. Random Forest Yield Prediction -- O(T * n * log n) train, O(T * log n) predict

Run from the algorithms/ folder:
    python generate_data.py   # once, to create farm_data.csv
    python main.py            # starts server on http://localhost:8000
"""

import os
import warnings
warnings.filterwarnings("ignore")

# Resolve paths relative to this script so it works from any directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error

# --- App -------------------------------------------------------------------
app = FastAPI(title="AgriPulse API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Algorithm constants (mirrors agronomy.ts) -----------------------------
MOISTURE_THRESHOLD = {"Wheat": 30, "Maize": 35, "Rice": 50, "Tomato": 28}
WATER_PER_HA       = {"Wheat": 3000, "Maize": 4000, "Rice": 6000, "Tomato": 2500}
FLOOD_PER_HA       = {"Wheat": 6000, "Maize": 8000, "Rice": 12000, "Tomato": 5000}

# Crop encoded as an integer so the RF can learn crop-specific yield patterns.
# (Without this feature the model gets negative R2 because crop base-yield
#  variance is 2-3x larger than all other signals combined.)
CROP_ENCODE   = {"Wheat": 0, "Maize": 1, "Rice": 2, "Tomato": 3}
FEATURE_NAMES = ["crop", "soil_moisture", "temperature", "rainfall", "humidity", "sunlight"]


def _make_X(crop: str, moisture: float, temp: float,
            rain: float, humidity: float, sunlight: float):
    """Build a single-row feature matrix for the RF predictor."""
    return np.array([[CROP_ENCODE.get(crop, 0),
                      moisture, temp, rain, humidity, sunlight]])


# --- Train Random Forest on startup ----------------------------------------
def build_model():
    csv_path = os.path.join(SCRIPT_DIR, "farm_data.csv")

    if os.path.exists(csv_path):
        df = pd.read_csv(csv_path)
        # Encode crop type -- critical for a good R2
        df["Crop_Enc"] = df["Crop_Type"].map(CROP_ENCODE).fillna(0).astype(int)
        features = [
            "Crop_Enc", "Soil_Moisture_Percent", "Temperature_C",
            "Rainfall_mm", "Humidity_Percent", "Sunlight_Hours",
        ]
        X = df[features].values
        y = df["Historical_Yield_kg"].values
        print(f"[OK] Loaded {len(df)} rows from farm_data.csv")
    else:
        print("[WARN] farm_data.csv not found -- training on synthetic data.")
        print("       Run `python generate_data.py` first for better accuracy.")
        np.random.seed(42)
        n = 200
        crops     = np.random.randint(0, 4, n)
        crop_base = np.array([3000, 5000, 4500, 8000])[crops]
        moisture  = np.random.uniform(10, 70, n)
        temp      = np.random.uniform(18, 40, n)
        rain      = np.random.uniform(0,  60, n)
        humidity  = np.random.uniform(30, 90, n)
        sunlight  = np.random.uniform(4,  12, n)
        y = (crop_base + moisture * 25 + rain * 15
             - np.abs(temp - 26) * 30
             + np.random.normal(0, 300, n)).clip(500, 15000)
        X = np.column_stack([crops, moisture, temp, rain, humidity, sunlight])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    rf = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    rf.fit(X_train, y_train)

    preds = rf.predict(X_test)
    r2  = round(float(r2_score(y_test, preds)), 3)
    mae = round(float(mean_absolute_error(y_test, preds)), 1)
    print(f"[OK] Random Forest trained -- R2: {r2}  MAE: {mae:.0f} kg")
    return rf, r2, mae


model, model_r2, model_mae = build_model()


# --- Request schemas -------------------------------------------------------
class Field(BaseModel):
    name: str
    crop: str                               # Wheat | Maize | Rice | Tomato
    area_ha: float
    soil_moisture_percent: float
    temperature_c: float
    rainfall_mm: float
    humidity_percent: Optional[float] = 60.0
    sunlight_hours:   Optional[float] = 8.0


class FieldsRequest(BaseModel):
    fields: List[Field]


# --- Algorithm 1: Greedy Water Scheduling -- O(n log n) --------------------
@app.post("/api/water-schedule")
def water_schedule(req: FieldsRequest):
    needs_water, skipped = [], []

    for f in req.fields:
        threshold = MOISTURE_THRESHOLD.get(f.crop, 35)
        if f.soil_moisture_percent < threshold:
            needs_water.append(f)
        else:
            skipped.append(f.name)

    # Greedy sort: driest (lowest moisture) fields irrigated first
    needs_water.sort(key=lambda f: f.soil_moisture_percent)

    schedule    = []
    total_water = 0

    for rank, f in enumerate(needs_water, 1):
        threshold   = MOISTURE_THRESHOLD.get(f.crop, 35)
        water       = round(WATER_PER_HA.get(f.crop, 3500) * f.area_ha)
        urgency     = "critical" if f.soil_moisture_percent < threshold * 0.6 else "moderate"
        total_water += water
        schedule.append({
            "rank":          rank,
            "name":          f.name,
            "crop":          f.crop,
            "area_ha":       f.area_ha,
            "moisture_pct":  f.soil_moisture_percent,
            "threshold_pct": threshold,
            "water_liters":  water,
            "urgency":       urgency,
        })

    if schedule:
        summary = (
            f"Scheduling {len(schedule)} field(s) for irrigation today "
            f"(skipping {len(skipped)} with sufficient moisture). "
            f"Total water required: {total_water:,} L."
        )
    else:
        summary = "All fields have sufficient moisture. No irrigation needed today."

    return {
        "success": True,
        "data": {
            "schedule":               schedule,
            "skipped":                skipped,
            "total_water_liters":     total_water,
            "fields_to_water":        len(schedule),
            "summary":                summary,
            "complexity_time":        "O(n log n)",
            "complexity_space":       "O(n)",
            "complexity_explanation": (
                "Fields sorted by ascending soil moisture (greedy). "
                "Driest fields are watered first to minimise crop stress."
            ),
        },
    }


# --- Algorithm 2: Random Forest Yield Prediction -- O(T * log n) -----------
@app.post("/api/yield-prediction")
def yield_prediction(req: FieldsRequest):
    importances = model.feature_importances_
    fi = sorted(
        [{"feature": FEATURE_NAMES[i], "importance": round(float(importances[i]), 4)}
         for i in range(len(FEATURE_NAMES))],
        key=lambda x: x["importance"], reverse=True,
    )
    top_factor = fi[0]["feature"]

    predictions  = []
    yield_values = []

    for f in req.fields:
        X        = _make_X(f.crop, f.soil_moisture_percent, f.temperature_c,
                           f.rainfall_mm, f.humidity_percent or 60.0,
                           f.sunlight_hours or 8.0)
        pred_kg  = round(float(model.predict(X)[0]))
        yield_per_ha = round(pred_kg / max(f.area_ha, 0.1), 1)
        predictions.append({
            "name":               f.name,
            "crop":               f.crop,
            "area_ha":            f.area_ha,
            "moisture_pct":       f.soil_moisture_percent,
            "temp_c":             f.temperature_c,
            "predicted_yield_kg": pred_kg,
            "yield_per_ha":       yield_per_ha,
            "accuracy_pct":       round(model_r2 * 100, 1),
            "top_factor":         top_factor,
        })
        yield_values.append(pred_kg)

    avg_yield = round(sum(yield_values) / len(yield_values)) if yield_values else 0
    best  = predictions[yield_values.index(max(yield_values))]["name"] if yield_values else ""
    worst = predictions[yield_values.index(min(yield_values))]["name"] if yield_values else ""

    summary = (
        f"Predicted average yield: {avg_yield:,} kg across {len(predictions)} field(s). "
        f"Best performer: {best}. Model R2: {model_r2}."
    ) if predictions else "No fields provided."

    return {
        "success": True,
        "data": {
            "predictions":         predictions,
            "model_r2":            model_r2,
            "model_mae_kg":        model_mae,
            "avg_yield_kg":        avg_yield,
            "best_field":          best,
            "worst_field":         worst,
            "feature_importances": fi,
            "complexity_train":    "O(T * n * log n)",
            "complexity_predict":  "O(T * log n)",
            "summary":             summary,
        },
    }


# --- Combined /api/analyze endpoint ----------------------------------------
@app.post("/api/analyze")
def analyze(req: FieldsRequest):
    ws = water_schedule(req)
    yp = yield_prediction(req)
    return {
        "success":          True,
        "water_schedule":   ws["data"],
        "yield_prediction": yp["data"],
    }


# --- Health check -----------------------------------------------------------
@app.get("/")
def root():
    return {
        "status":    "AgriPulse API running",
        "model_r2":  model_r2,
        "endpoints": ["/api/water-schedule", "/api/yield-prediction", "/api/analyze"],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
