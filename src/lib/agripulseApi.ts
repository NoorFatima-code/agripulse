// AgriPulse FastAPI client
// Set VITE_AGRIPULSE_API_URL in your .env (e.g. http://localhost:8000 or your deployed URL)

const API_URL =
  (import.meta.env.VITE_AGRIPULSE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000";

export interface ApiField {
  name: string;
  crop: "Wheat" | "Maize" | "Rice" | "Tomato";
  area_ha: number;
  soil_moisture_percent: number;
  temperature_c: number;
  rainfall_mm: number;
}

export interface WaterScheduleItem {
  rank: number;
  name: string;
  crop: string;
  area_ha: number;
  moisture_pct: number;
  threshold_pct: number;
  water_liters: number;
  urgency: "critical" | "moderate";
}

export interface WaterScheduleData {
  schedule: WaterScheduleItem[];
  skipped: string[];
  total_water_liters: number;
  fields_to_water: number;
  summary: string;
  complexity_time: string;
  complexity_space: string;
  complexity_explanation: string;
}

export interface YieldPredictionItem {
  name: string;
  crop: string;
  area_ha: number;
  moisture_pct: number;
  temp_c: number;
  predicted_yield_kg: number;
  yield_per_ha: number;
  accuracy_pct: number;
  top_factor: string;
}

export interface YieldPredictionData {
  predictions: YieldPredictionItem[];
  model_r2: number;
  model_mae_kg: number;
  avg_yield_kg: number;
  best_field: string;
  worst_field: string;
  feature_importances: { feature: string; importance: number }[];
  complexity_train: string;
  complexity_predict: string;
  summary: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function getApiUrl() {
  return API_URL;
}

export async function fetchWaterSchedule(fields: ApiField[]) {
  const res = await post<{ success: boolean; data: WaterScheduleData }>(
    "/api/water-schedule",
    { fields },
  );
  return res.data;
}

export async function fetchYieldPrediction(fields: ApiField[]) {
  const res = await post<{ success: boolean; data: YieldPredictionData }>(
    "/api/yield-prediction",
    { fields },
  );
  return res.data;
}

export async function fetchAnalyze(fields: ApiField[]) {
  return post<{
    success: boolean;
    water_schedule: WaterScheduleData;
    yield_prediction: YieldPredictionData;
  }>("/api/analyze", { fields });
}

// Map app crop keys to API crop names (only 4 supported by the API).
export function toApiCrop(crop: string): ApiField["crop"] {
  const c = crop.toLowerCase();
  if (c === "wheat" || c === "cotton") return "Wheat";
  if (c === "maize" || c === "soybean") return "Maize";
  if (c === "rice") return "Rice";
  if (c === "tomato") return "Tomato";
  return "Wheat";
}
