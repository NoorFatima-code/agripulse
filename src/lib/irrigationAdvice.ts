import type { Language } from "./i18n";

export interface FieldLike {
  name: string;
  crop: string;
  soil: string | null;
  area_ha: number;
  flow_lpm: number;
  last_watered_at: string | null;
}

export interface DailyAdvice {
  shouldWater: boolean;
  liters: number;
  minutes: number;
  title: string;
  body: string;
  type: "irrigation" | "success" | "info";
}

// ─── Algorithm 1 constants (mirrors main.py) ─────────────────────────────────
const MOISTURE_THRESHOLD: Record<string, number> = {
  wheat: 30, maize: 35, rice: 50, tomato: 28, cotton: 30, soybean: 35,
};

const WATER_PER_HA: Record<string, number> = {
  wheat: 3000, maize: 4000, rice: 6000, tomato: 2500, cotton: 3000, soybean: 3500,
};

// Days since last watering as a proxy for soil moisture depletion.
// Assumes ~5% moisture consumed per day after watering.
function estimatedMoisture(lastWateredAt: string | null): number {
  if (!lastWateredAt) return 15; // unknown — assume dry
  const daysSince = (Date.now() - new Date(lastWateredAt).getTime()) / 86_400_000;
  return Math.max(10, 60 - daysSince * 5);
}

/**
 * Algorithm 1 — Greedy Water Scheduling
 * Determines if the field needs water today using moisture threshold comparison.
 * O(1) per field; the full greedy sort (O(n log n)) applies when scheduling
 * multiple fields together in the backend.
 */
export function computeDailyAdvice(field: FieldLike, lang: Language): DailyAdvice {
  const crop = field.crop.toLowerCase();
  const threshold = MOISTURE_THRESHOLD[crop] ?? 35;
  const moisture = estimatedMoisture(field.last_watered_at);
  const shouldWater = moisture < threshold;

  const liters = shouldWater ? Math.round((WATER_PER_HA[crop] ?? 3500) * field.area_ha) : 0;
  const minutes = liters > 0 && field.flow_lpm > 0 ? Math.round(liters / field.flow_lpm) : 0;
  const urgency = moisture < threshold * 0.6 ? "CRITICAL" : "MODERATE";

  if (!shouldWater) {
    return {
      shouldWater: false,
      liters: 0,
      minutes: 0,
      type: "success",
      ...noWaterMsg(field.name, lang),
    };
  }

  return {
    shouldWater: true,
    liters,
    minutes,
    type: "irrigation",
    ...waterMsg(field.name, crop, liters, minutes, urgency, lang),
  };
}

// ─── Localised messages ───────────────────────────────────────────────────────

function noWaterMsg(name: string, lang: Language) {
  if (lang === "ur") {
    return {
      title: `${name}: آج پانی کی ضرورت نہیں`,
      body: "مٹی میں کافی نمی ہے۔ کل دوبارہ چیک کریں۔",
    };
  }
  return {
    title: `${name}: No watering needed today`,
    body: "Soil moisture is sufficient. Check again tomorrow.",
  };
}

function waterMsg(
  name: string,
  crop: string,
  liters: number,
  minutes: number,
  urgency: string,
  lang: Language,
) {
  const cropLabel = crop.charAt(0).toUpperCase() + crop.slice(1);
  const prefix = urgency === "CRITICAL" ? "URGENT: " : "";

  if (lang === "ur") {
    return {
      title: `${prefix}${name}: آج ${liters.toLocaleString()} لیٹر پانی دیں`,
      body: `${cropLabel} کو ${minutes} منٹ پمپ چلائیں۔ مٹی بہت خشک ہے۔`,
    };
  }
  return {
    title: `${prefix}${name}: Apply ${liters.toLocaleString()} L today`,
    body: `Run your pump for ~${minutes} min. ${cropLabel} moisture is below threshold.`,
  };
}
