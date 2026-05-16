"""
Generate farm_data.csv — run this ONCE before starting the API.
Creates 100 realistic farm field records for Random Forest training.
"""

import pandas as pd
import numpy as np

np.random.seed(42)
n = 100

CROPS      = ["Wheat", "Maize", "Rice", "Tomato"]
SOIL_TYPES = ["Sandy", "Loamy", "Clay", "Silty"]

crop_list  = np.random.choice(CROPS, n)
soil_list  = np.random.choice(SOIL_TYPES, n)
area_list  = np.round(np.random.uniform(0.5, 10.0, n), 1)
moisture   = np.round(np.random.uniform(10.0, 70.0, n), 1)
temp       = np.round(np.random.uniform(18.0, 40.0, n), 1)
rain       = np.round(np.random.uniform(0.0, 60.0, n), 1)
humidity   = np.round(np.random.uniform(30.0, 90.0, n), 1)
sunlight   = np.round(np.random.uniform(4.0, 12.0, n), 1)

# Realistic yield formula
crop_base  = {"Wheat": 3000, "Maize": 5000, "Rice": 4500, "Tomato": 8000}
yield_kg   = np.array([
    crop_base[c]
    + moisture[i] * 25
    + rain[i] * 15
    - abs(temp[i] - 26) * 30
    + np.random.normal(0, 300)
    for i, c in enumerate(crop_list)
]).clip(500, 15000).astype(int)

field_names = [f"Field_{str(i+1).zfill(3)}" for i in range(n)]

df = pd.DataFrame({
    "Field_ID":              [f"F{str(i+1).zfill(3)}" for i in range(n)],
    "Field_Name":            field_names,
    "Crop_Type":             crop_list,
    "Soil_Type":             soil_list,
    "Area_ha":               area_list,
    "Soil_Moisture_Percent": moisture,
    "Temperature_C":         temp,
    "Rainfall_mm":           rain,
    "Humidity_Percent":      humidity,
    "Sunlight_Hours":        sunlight,
    "Historical_Yield_kg":   yield_kg,
})

df.to_csv("farm_data.csv", index=False)
print(f"✅ farm_data.csv created with {n} rows!")
print(df.head())
