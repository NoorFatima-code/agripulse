# Lovable Prompt — Connect AgriPulse to FastAPI Backend

Paste this EXACTLY into Lovable's chat:

---

## PROMPT TO PASTE IN LOVABLE:

I want to connect my AgriPulse estimator to a real FastAPI backend. 
Please update the estimator so it calls my API instead of using hardcoded calculations.

**API Base URL:** `http://localhost:8000`

**Endpoint to call:** `POST /analyze`

**When to call it:** When the user changes any input on the Estimator Inputs page 
(or clicks "See results"), send a POST request to `/analyze` with this JSON body:

```json
{
  "field_name": "My Field",
  "crop_type": "Maize",
  "soil_type": "Loamy",
  "area_ha": 5.0,
  "soil_moisture_percent": 25.0,
  "temperature_c": 26,
  "rainfall_mm": 12,
  "humidity_percent": 60,
  "sunlight_hours": 9
}
```

**Map my existing inputs to the JSON fields like this:**
- Field Area slider → `area_ha`
- Crop Type dropdown → `crop_type`  
- Soil Type selector → `soil_type`
- Avg Temperature slider → `temperature_c`
- Humidity slider → `humidity_percent`
- Rainfall input → `rainfall_mm`
- Sunlight input → `sunlight_hours`
- For `soil_moisture_percent`: add a new slider (range 10–70, default 25, label "Soil Moisture %")

**The API response looks like this:**
```json
{
  "daily_water_m3": 2.86,
  "daily_water_mm": 5.7,
  "predicted_yield_tons": 4.2,
  "yield_per_ha": 0.84,
  "water_savings_pct": 50,
  "efficiency_score": 72,
  "weekly_water_L": 20000,
  "recommendation": "Apply 2.86 m³ across your 5 ha Maize field today...",
  "watering_needed": true,
  "urgency": "MODERATE"
}
```

**Update the Results page cards to show:**
- "Daily Water Need" card → `daily_water_m3` m³/day and `daily_water_mm` mm
- "Predicted Yield" card → `predicted_yield_tons` tons and `yield_per_ha` t/ha
- "Water Savings" card → `water_savings_pct`%
- "Efficiency Score" card → `efficiency_score` / 100
- Irrigation recommendation text → `recommendation` field
- Show a red badge if `urgency` is "CRITICAL", yellow if "MODERATE", green if "NONE"

**While the API is loading**, show a loading spinner on the Results page cards.

**If the API call fails** (e.g. backend not running), show a friendly error: 
"Backend not connected. Run the FastAPI server locally to see real results."

Do NOT remove any existing UI — just replace the hardcoded 0.0 values with real API data.

---
