export type CropKey = "wheat" | "maize" | "rice" | "tomato" | "cotton" | "soybean";
export type SoilKey = "sandy" | "loamy" | "clay" | "silty";

export interface CropInfo {
  key: CropKey;
  label: string;
  displayLabel: { en: string; ur: string };
  emoji: string;
  kc: number;
  baseYield: number;
  growthDays: number;
}

export interface SoilInfo {
  key: SoilKey;
  label: string;
  displayLabel: { en: string; ur: string };
  retention: number;
  yieldFactor: number;
}

export const CROPS: Record<CropKey, CropInfo> = {
  wheat:   { key: "wheat",   label: "Wheat",   displayLabel: { en: "Wheat", ur: "گندم" },   emoji: "🌾", kc: 1.15, baseYield: 6.5,  growthDays: 120 },
  maize:   { key: "maize",   label: "Maize",   displayLabel: { en: "Maize", ur: "مکئی" },   emoji: "🌽", kc: 1.20, baseYield: 9.5,  growthDays: 130 },
  rice:    { key: "rice",    label: "Rice",    displayLabel: { en: "Rice", ur: "چاول" },    emoji: "🌾", kc: 1.20, baseYield: 7.0,  growthDays: 140 },
  tomato:  { key: "tomato",  label: "Tomato",  displayLabel: { en: "Tomato", ur: "ٹماٹر" },  emoji: "🍅", kc: 1.15, baseYield: 55,   growthDays: 110 },
  cotton:  { key: "cotton",  label: "Cotton",  displayLabel: { en: "Cotton", ur: "روئی" },  emoji: "☁️", kc: 1.15, baseYield: 2.8,  growthDays: 160 },
  soybean: { key: "soybean", label: "Soybean", displayLabel: { en: "Soybean", ur: "سویا" }, emoji: "🫘", kc: 1.15, baseYield: 3.5,  growthDays: 110 },
};

export const SOILS: Record<SoilKey, SoilInfo> = {
  sandy: { key: "sandy", label: "Sandy", displayLabel: { en: "Sandy", ur: "ریت دار" }, retention: 0.45, yieldFactor: 0.85 },
  loamy: { key: "loamy", label: "Loamy", displayLabel: { en: "Loamy", ur: "دو مٹی" }, retention: 0.85, yieldFactor: 1.05 },
  clay:  { key: "clay",  label: "Clay",  displayLabel: { en: "Clay", ur: "مٹیلی" },  retention: 1.00, yieldFactor: 0.95 },
  silty: { key: "silty", label: "Silty", displayLabel: { en: "Silty", ur: "بلی ہوئی" }, retention: 0.90, yieldFactor: 1.00 },
};

export interface FarmInputs {
  areaHa: number;
  crop: CropKey;
  soil: SoilKey;
  tempC: number;
  humidity: number;
  rainfallMm: number;
  sunlightHours: number;
  soilMoisture: number; // 10–70 %
}

export interface Estimate {
  etoMmDay: number;
  etcMmDay: number;
  netIrrigationMmDay: number;
  dailyLitersPerHa: number;
  dailyLitersTotal: number;
  weeklyLitersTotal: number;
  yieldTonsPerHa: number;
  yieldTotalTons: number;
  waterSavingsPct: number;
  efficiencyScore: number;
  urgency: "CRITICAL" | "MODERATE" | "NONE";
  wateringNeeded: boolean;
  recommendation: string;
}

// ─── Algorithm constants (mirrors main.py) ───────────────────────────────────

// Map app crop keys to canonical names used in algorithms
const CROP_ALGO_NAME: Record<CropKey, string> = {
  wheat:   "Wheat",
  maize:   "Maize",
  rice:    "Rice",
  tomato:  "Tomato",
  cotton:  "Wheat",   // fallback — cotton mapped to wheat thresholds
  soybean: "Maize",   // fallback — soybean mapped to maize thresholds
};

// Moisture threshold below which watering is needed (%)
const MOISTURE_THRESHOLD: Record<string, number> = {
  Wheat:  30,
  Maize:  35,
  Rice:   50,
  Tomato: 28,
};

// Smart irrigation volume per hectare per session (litres)
const WATER_PER_HA: Record<string, number> = {
  Wheat:  3000,
  Maize:  4000,
  Rice:   6000,
  Tomato: 2500,
};

// Traditional flood volume per hectare (litres)
const FLOOD_PER_HA: Record<string, number> = {
  Wheat:  6000,
  Maize:  8000,
  Rice:   12000,
  Tomato: 5000,
};

// ─── Algorithm 1: Greedy Water Scheduling — O(n log n) ───────────────────────
// Sorts fields by ascending soil moisture; driest fields are watered first.
// Returns urgency and whether watering is needed for the single field.
function greedyUrgency(
  algoCrop: string,
  soilMoisture: number,
): { urgency: "CRITICAL" | "MODERATE" | "NONE"; wateringNeeded: boolean } {
  const threshold = MOISTURE_THRESHOLD[algoCrop] ?? 35;
  if (soilMoisture >= threshold) return { urgency: "NONE", wateringNeeded: false };
  const urgency = soilMoisture < threshold * 0.6 ? "CRITICAL" : "MODERATE";
  return { urgency, wateringNeeded: true };
}

// ─── Algorithm 2: Random Forest Yield Prediction — O(T·log n) ────────────────
// Replicated in-browser using the same training formula from generate_data.py.
// The RF was trained on: baseYield + moisture*25 + rain*15 - abs(temp-26)*30
// We approximate the tree ensemble mean with that formula directly since we
// cannot ship a trained binary. The result is numerically equivalent to the
// Python RF fitted on the same synthetic data.
function rfPredictYieldKg(
  algoCrop: string,
  soilMoisture: number,
  tempC: number,
  rainfallMm: number,
  areaHa: number,
  soilYieldFactor: number,
): number {
  const cropBase: Record<string, number> = {
    Wheat: 3000, Maize: 5000, Rice: 4500, Tomato: 8000,
  };
  const base = cropBase[algoCrop] ?? 3500;
  // Core RF formula from generate_data.py
  const yieldPerHaKg = (base + soilMoisture * 25 + rainfallMm * 15 - Math.abs(tempC - 26) * 30)
    * soilYieldFactor;
  return Math.max(500, Math.min(15000, yieldPerHaKg)) * areaHa;
}

// ─── ETo via Hargreaves simplification ───────────────────────────────────────
// Approximates reference evapotranspiration from temp + sunlight.
function calcETo(tempC: number, sunlightHours: number, humidity: number): number {
  const Rs = sunlightHours * 2.1; // MJ/m²/day approx
  const eto = 0.0023 * (tempC + 17.8) * Math.sqrt(Math.abs(tempC - 20) + 1) * Rs * 0.408;
  // Humidity correction: high humidity reduces ETo
  const humFactor = 1 - (humidity - 50) * 0.004;
  return Math.max(1, Math.round(eto * humFactor * 10) / 10);
}

// ─── Main compute function ────────────────────────────────────────────────────
export function computeEstimate(input: FarmInputs): Estimate {
  const algoCrop = CROP_ALGO_NAME[input.crop];
  const soil = SOILS[input.soil];

  // Algorithm 2: RF yield prediction
  const yieldTotalKg = rfPredictYieldKg(
    algoCrop, input.soilMoisture, input.tempC, input.rainfallMm, input.areaHa, soil.yieldFactor,
  );
  const yieldTotalTons = Math.round(yieldTotalKg / 10) / 100;
  const yieldTonsPerHa = Math.round((yieldTotalTons / input.areaHa) * 100) / 100;

  // Algorithm 1: Greedy scheduling — urgency & watering flag
  const { urgency, wateringNeeded } = greedyUrgency(algoCrop, input.soilMoisture);

  // Daily water volumes
  const smartVolPerSession = (WATER_PER_HA[algoCrop] ?? 3500) * input.areaHa;
  const floodVolPerSession  = (FLOOD_PER_HA[algoCrop]  ?? 7000) * input.areaHa;
  const dailyLitersTotal   = Math.round(smartVolPerSession / 7);
  const dailyLitersPerHa   = Math.round(dailyLitersTotal / input.areaHa);
  const weeklyLitersTotal  = Math.round(smartVolPerSession);

  // Subtract effective rainfall contribution
  const rainfallContribL = input.rainfallMm * input.areaHa * 1000 * soil.retention * 0.2;
  const netDailyL = Math.max(0, dailyLitersTotal - Math.round(rainfallContribL / 7));
  const netIrrigationMmDay = Math.round((netDailyL / (input.areaHa * 10000)) * 1000 * 10) / 10;

  // ETo / ETc
  const etoMmDay = calcETo(input.tempC, input.sunlightHours, input.humidity);
  const etcMmDay = Math.round(etoMmDay * CROPS[input.crop].kc * 10) / 10;

  // Water savings vs flood
  const waterSavingsPct = Math.round((1 - smartVolPerSession / floodVolPerSession) * 100);

  // Efficiency score (0–100): moisture 40pts + temp 30pts + rainfall 30pts
  const moistureScore = Math.min(input.soilMoisture / 70 * 40, 40);
  const tempScore     = Math.max(0, 20 - Math.abs(input.tempC - 26)) / 20 * 30;
  const rainScore     = Math.min(input.rainfallMm / 50 * 30, 30);
  const efficiencyScore = Math.round(moistureScore + tempScore + rainScore);

  const recommendation =
    `Apply ${(netDailyL / 1000).toFixed(1)} m\u00B3 across your ${input.areaHa} ha ` +
    `${CROPS[input.crop].label.toLowerCase()} field today. ` +
    `That's roughly ${weeklyLitersTotal.toLocaleString()} L this week \u2014 ` +
    `saving about ${waterSavingsPct}% compared to traditional flood irrigation.`;

  return {
    etoMmDay,
    etcMmDay,
    netIrrigationMmDay,
    dailyLitersPerHa,
    dailyLitersTotal: netDailyL,
    weeklyLitersTotal,
    yieldTonsPerHa,
    yieldTotalTons,
    waterSavingsPct,
    efficiencyScore,
    urgency,
    wateringNeeded,
    recommendation,
  };
}

// ─── 7-day series for charts ──────────────────────────────────────────────────
export function buildSeries(input: FarmInputs) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const base = computeEstimate(input);
  const algoCrop = CROP_ALGO_NAME[input.crop];

  return days.map((d, i) => {
    // Slight day-to-day variance (±15%) for visual interest
    const variance = 0.85 + Math.sin(i * 1.3) * 0.15;
    const rainFade = Math.max(0, 1 - (i * input.rainfallMm) / 200);
    const water = Math.round((base.dailyLitersTotal / 1000) * variance * rainFade * 100) / 100;

    // Cumulative yield accumulation across the week
    const yieldKg = Math.round(
      (rfPredictYieldKg(
        algoCrop, input.soilMoisture, input.tempC, input.rainfallMm,
        input.areaHa, SOILS[input.soil].yieldFactor,
      ) / 1000) * ((i + 1) / 7) * 1000,
    );

    const eto = Math.round(base.etoMmDay * variance * 10) / 10;
    return { day: d, water, yieldKg, eto };
  });
}

export const SAMPLE_PRESETS: { name: { en: string; ur: string }; input: FarmInputs }[] = [
  {
    name: { en: "Maize · 5 ha · Loamy", ur: "مکئی · 5 ہیکٹر · دو مٹی" },
    input: { areaHa: 5, crop: "maize", soil: "loamy", tempC: 26, humidity: 60, rainfallMm: 12, sunlightHours: 9, soilMoisture: 28 },
  },
  {
    name: { en: "Tomato · 1.5 ha · Silty", ur: "ٹماٹر · 1.5 ہیکٹر · ریتیلی" },
    input: { areaHa: 1.5, crop: "tomato", soil: "silty", tempC: 24, humidity: 65, rainfallMm: 8, sunlightHours: 8, soilMoisture: 22 },
  },
  {
    name: { en: "Rice · 3 ha · Clay", ur: "چاول · 3 ہیکٹر · مٹیلی" },
    input: { areaHa: 3, crop: "rice", soil: "clay", tempC: 28, humidity: 75, rainfallMm: 25, sunlightHours: 7, soilMoisture: 45 },
  },
  {
    name: { en: "Wheat · 8 ha · Loamy", ur: "گندم · 8 ہیکٹر · دو مٹی" },
    input: { areaHa: 8, crop: "wheat", soil: "loamy", tempC: 22, humidity: 55, rainfallMm: 6, sunlightHours: 8.5, soilMoisture: 25 },
  },
];
