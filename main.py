"""
╔══════════════════════════════════════════════════════════════════════╗
║     AgriPulse — FastAPI Backend                                      ║
║     Algorithm 1: Greedy Water Scheduling                             ║
║     Algorithm 2: Random Forest Yield Prediction                      ║
╚══════════════════════════════════════════════════════════════════════╝

HOW TO RUN:
  1. pip install fastapi uvicorn scikit-learn pandas numpy
  2. python generate_data.py   (only once — creates farm_data.csv)
  3. uvicorn main:app --reload --port 8000

API Docs: http://localhost:8000/docs
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import warnings
warnings.filterwarnings("ignore")

# ──────────────────────────────────────────────────────────────
# App Setup
# ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="AgriPulse API",
    description="Smart Irrigation & Yield Prediction — DAA Project",
    version="1.0.0"
)

# Allow Lovable frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # In production, replace * with your Lovable URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────
# Input Schema — matches Lovable app's estimator fields exactly
# ──────────────────────────────────────────────────────────────
class FieldInput(BaseModel):
    field_name: Optional[str] = "My Field"
    crop_type: str                  # "Wheat" | "Maize" | "Rice" | "Tomato"
    soil_type: Optional[str] = "Loamy"
    area_ha: float                  # Field area in hectares
    soil_moisture_percent: float    # Current soil moisture %
    temperature_c: float            # Average temperature in °C
    rainfall_mm: float              # Rainfall last 7 days in mm
    humidity_percent: Optional[float] = 60.0
    sunlight_hours: Optional[float] = 9.0


# ──────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────
MOISTURE_THRESHOLD = {
    "Wheat":  30.0,
    "Maize":  35.0,
    "Rice":   50.0,
    "Tomato": 28.0,
}

WATER_NEEDED_PER_HA = {   # litres per hectare per session
    "Wheat":  3000,
    "Maize":  4000,
    "Rice":   6000,
    "Tomato": 2500,
}

TRADITIONAL_FLOOD_PER_HA = {
    "Wheat":  6000,
    "Maize":  8000,
    "Rice":   12000,
    "Tomato": 5000,
}

# ──────────────────────────────────────────────────────────────
# Train Random Forest once at startup using farm_data.csv
# ──────────────────────────────────────────────────────────────
rf_model = None
label_encoder = LabelEncoder()
CROP_CLASSES = ["Wheat", "Maize", "Rice", "Tomato"]
label_encoder.fit(CROP_CLASSES)

def train_model():
    global rf_model
    try:
        df = pd.read_csv("farm_data.csv")
        df["Crop_Encoded"] = label_encoder.transform(df["Crop_Type"])
        X = df[["Soil_Moisture_Percent", "Temperature_C", "Rainfall_mm", "Crop_Encoded"]]
        y = df["Historical_Yield_kg"]
        rf_model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
        rf_model.fit(X, y)
        print("✅ Random Forest model trained successfully!")
    except FileNotFoundError:
        print("⚠️  farm_data.csv not found. Run generate_data.py first.")
        # Fallback: train on minimal synthetic data so API still works
        _train_fallback()

def _train_fallback():
    """Train on tiny synthetic data if CSV missing — API won't crash."""
    global rf_model
    np.random.seed(42)
    n = 200
    crops = np.random.choice([0, 1, 2, 3], n)
    moisture = np.random.uniform(15, 70, n)
    temp = np.random.uniform(18, 40, n)
    rain = np.random.uniform(0, 50, n)
    yield_kg = 2000 + moisture * 30 + rain * 10 - temp * 20 + crops * 500 + np.random.normal(0, 200, n)
    X = np.column_stack([moisture, temp, rain, crops])
    rf_model = RandomForestRegressor(n_estimators=100, random_state=42)
    rf_model.fit(X, yield_kg)
    print("✅ Fallback model trained on synthetic data.")

# Train at startup
train_model()


# ──────────────────────────────────────────────────────────────
# ALGORITHM 1: Greedy Water Scheduling
# Time Complexity: O(n log n) — dominated by sort step
# ──────────────────────────────────────────────────────────────
def greedy_water_schedule(fields: list[dict]) -> dict:
    """
    Greedy Strategy: Water the driest field first.
    Sort all fields by Soil_Moisture_Percent (ascending).
    Fields below their crop threshold get scheduled.
    """
    # O(n log n) — sort by moisture ascending
    sorted_fields = sorted(fields, key=lambda x: x["soil_moisture_percent"])

    schedule = []
    skipped = []
    total_water_litres = 0
    total_traditional = 0

    for rank, field in enumerate(sorted_fields, start=1):
        crop      = field["crop_type"]
        moisture  = field["soil_moisture_percent"]
        threshold = MOISTURE_THRESHOLD.get(crop, 35.0)
        area      = field["area_ha"]
        smart_vol = WATER_NEEDED_PER_HA.get(crop, 3500) * area
        trad_vol  = TRADITIONAL_FLOOD_PER_HA.get(crop, 7000) * area

        total_traditional += trad_vol

        if moisture < threshold:
            urgency = "CRITICAL" if moisture < threshold * 0.6 else "MODERATE"
            savings_pct = round((1 - smart_vol / trad_vol) * 100, 1)
            schedule.append({
                "priority":       rank,
                "field_name":     field.get("field_name", f"Field {rank}"),
                "crop":           crop,
                "area_ha":        area,
                "moisture_pct":   moisture,
                "threshold_pct":  threshold,
                "water_needed_L": int(smart_vol),
                "water_needed_m3": round(smart_vol / 1000, 2),
                "urgency":        urgency,
                "water_savings_pct": savings_pct,
            })
            total_water_litres += smart_vol
        else:
            skipped.append(field.get("field_name", crop))

    overall_savings = 0
    if total_traditional > 0:
        overall_savings = round((1 - total_water_litres / total_traditional) * 100, 1)

    return {
        "algorithm":          "Greedy — O(n log n)",
        "fields_scheduled":   len(schedule),
        "fields_skipped":     len(skipped),
        "skipped_names":      skipped,
        "schedule":           schedule,
        "total_water_L":      int(total_water_litres),
        "total_water_m3":     round(total_water_litres / 1000, 2),
        "water_savings_pct":  overall_savings,
        "complexity": {
            "time":  "O(n log n)",
            "space": "O(n)",
            "reason": "Sorting n fields by moisture is the dominant operation"
        }
    }


# ──────────────────────────────────────────────────────────────
# ALGORITHM 2: Random Forest Yield Prediction
# Time Complexity: O(T · log n) per prediction
# ──────────────────────────────────────────────────────────────
def predict_yield(field: dict) -> dict:
    """
    Random Forest predicts Historical_Yield_kg from:
    Soil_Moisture_Percent, Temperature_C, Rainfall_mm, Crop_Type
    """
    crop_encoded = label_encoder.transform([field["crop_type"]])[0]
    X_new = np.array([[
        field["soil_moisture_percent"],
        field["temperature_c"],
        field["rainfall_mm"],
        crop_encoded
    ]])

    predicted_yield = rf_model.predict(X_new)[0]

    # Efficiency score: 0–100 based on moisture, temp, rainfall
    moisture_score = min(field["soil_moisture_percent"] / 70 * 40, 40)
    temp_ideal     = max(0, 20 - abs(field["temperature_c"] - 26)) / 20 * 30
    rain_score     = min(field["rainfall_mm"] / 50 * 30, 30)
    efficiency     = round(moisture_score + temp_ideal + rain_score)

    # Daily water need in m3/day
    crop      = field["crop_type"]
    area      = field["area_ha"]
    daily_m3  = round(WATER_NEEDED_PER_HA.get(crop, 3500) * area / 1000 / 7, 2)
    daily_mm  = round(daily_m3 * 1000 / (area * 10000) * 1000, 1)

    # Water savings vs flood
    smart_total = WATER_NEEDED_PER_HA.get(crop, 3500) * area
    trad_total  = TRADITIONAL_FLOOD_PER_HA.get(crop, 7000) * area
    savings_pct = round((1 - smart_total / trad_total) * 100, 1)

    return {
        "algorithm":        "Random Forest — O(T · log n) prediction",
        "predicted_yield_kg":   round(predicted_yield),
        "predicted_yield_tons": round(predicted_yield / 1000, 2),
        "yield_per_ha":         round(predicted_yield / area / 1000, 2),
        "efficiency_score":     efficiency,
        "daily_water_m3":       daily_m3,
        "daily_water_mm":       daily_mm,
        "water_savings_pct":    savings_pct,
        "weekly_water_L":       int(smart_total),
        "complexity": {
            "training":    "O(T · n · log n · m)",
            "prediction":  "O(T · log n)",
            "space":       "O(T · n)",
            "T": "100 trees", "n": "training samples", "m": "√features"
        }
    }


# ──────────────────────────────────────────────────────────────
# API ENDPOINTS
# ──────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "app": "AgriPulse API",
        "status": "running",
        "endpoints": ["/get-schedule", "/predict-yield", "/analyze", "/docs"]
    }


@app.post("/get-schedule")
def get_schedule(fields: list[FieldInput]):
    """
    ALGORITHM 1 — Greedy Water Scheduling
    Send a list of fields → get priority watering schedule back.
    Time Complexity: O(n log n)
    """
    fields_list = [f.dict() for f in fields]
    result = greedy_water_schedule(fields_list)
    return result


@app.post("/predict-yield")
def get_yield_prediction(field: FieldInput):
    """
    ALGORITHM 2 — Random Forest Yield Prediction
    Send one field's data → get predicted yield + water stats.
    Time Complexity: O(T · log n) per prediction
    """
    result = predict_yield(field.dict())
    return result


@app.post("/analyze")
def analyze_field(field: FieldInput):
    """
    COMBINED ENDPOINT — runs both algorithms for one field.
    This is what the Lovable frontend should call.
    Returns everything the Results page needs in one shot.
    """
    field_dict = field.dict()

    # Run both algorithms
    schedule = greedy_water_schedule([field_dict])
    yield_pred = predict_yield(field_dict)

    return {
        "field_name":           field.field_name,
        "crop_type":            field.crop_type,
        "area_ha":              field.area_ha,

        # For Results page cards
        "daily_water_m3":       yield_pred["daily_water_m3"],
        "daily_water_mm":       yield_pred["daily_water_mm"],
        "predicted_yield_tons": yield_pred["predicted_yield_tons"],
        "yield_per_ha":         yield_pred["yield_per_ha"],
        "water_savings_pct":    yield_pred["water_savings_pct"],
        "efficiency_score":     yield_pred["efficiency_score"],
        "weekly_water_L":       yield_pred["weekly_water_L"],

        # Irrigation recommendation text
        "recommendation": (
            f"Apply {yield_pred['daily_water_m3']} m³ across your "
            f"{field.area_ha} ha {field.crop_type} field today. "
            f"That's roughly {yield_pred['weekly_water_L']:,} L this week — "
            f"saving about {yield_pred['water_savings_pct']}% compared to "
            f"traditional flood irrigation."
        ),

        # Watering needed?
        "watering_needed":      len(schedule["schedule"]) > 0,
        "urgency":              schedule["schedule"][0]["urgency"] if schedule["schedule"] else "NONE",

        # Full algorithm results
        "greedy_result":  schedule,
        "forest_result":  yield_pred,
    }
