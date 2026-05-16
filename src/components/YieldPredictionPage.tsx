import { useState, useEffect, useMemo } from "react";
import {
  Cpu, ChevronDown, ChevronUp, Info, Loader2, TrendingUp, CloudSun, MapPin,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { getUserFields } from "@/integrations/supabase/database";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useWeather } from "@/hooks/useWeather";
import { computeEstimate, type CropKey, type SoilKey } from "@/lib/agronomy";

// ─── helpers ─────────────────────────────────────────────────────────────────
function toCropKey(s: string): CropKey {
  const l = s.toLowerCase();
  if (l.includes("maize") || l.includes("corn")) return "maize";
  if (l.includes("rice"))   return "rice";
  if (l.includes("tomato")) return "tomato";
  if (l.includes("cotton")) return "cotton";
  if (l.includes("soy"))    return "soybean";
  return "wheat";
}
function toSoilKey(s?: string): SoilKey {
  const l = (s ?? "").toLowerCase();
  if (l.includes("sandy")) return "sandy";
  if (l.includes("clay"))  return "clay";
  if (l.includes("silty")) return "silty";
  return "loamy";
}

interface PredictionRow {
  id: string;
  name: string;
  crop: string;
  areaHa: number;
  yieldKgPerHa: number;
  yieldTotalTons: number;
  efficiency: number;
  urgency: string;
  waterM3: number;
}

interface Conditions {
  soilMoisture: number;
  tempC: number;
  rainfallMm: number;
  sunlightHours: number;
  humidity: number;
}

const DEFAULT_CONDITIONS: Conditions = {
  soilMoisture: 32,
  tempC: 26,
  rainfallMm: 10,
  sunlightHours: 8,
  humidity: 60,
};

const CHART_COLORS = [
  "oklch(0.55 0.14 145)",
  "oklch(0.65 0.14 230)",
  "oklch(0.70 0.15 75)",
  "oklch(0.60 0.14 300)",
  "oklch(0.65 0.14 30)",
];

const tooltipStyle = {
  background: "hsl(0 0% 100%)",
  border: "1px solid oklch(0.9 0.02 150)",
  borderRadius: "12px",
  fontSize: "12px",
} as const;

// ─── component ───────────────────────────────────────────────────────────────
export function YieldPredictionPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { fetchWeather, loading: weatherLoading, city, conditions: weatherConds, error: weatherError } = useWeather();
  const [loading, setLoading]     = useState(true);
  const [rawFields, setRawFields] = useState<any[]>([]);
  const [conds, setConds]         = useState<Conditions>(DEFAULT_CONDITIONS);
  const [showConds, setShowConds] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getUserFields(user.id).then(({ data }) => {
      setRawFields(data ?? []);
      setLoading(false);
    });
  }, [user?.id]);

  // When weather data arrives, apply it to conditions
  useEffect(() => {
    if (weatherConds) setConds(weatherConds);
  }, [weatherConds]);

  // Recompute live whenever conditions or fields change
  const predictions = useMemo<PredictionRow[]>(() => {
    return rawFields.map((f, i) => {
      const cropKey = toCropKey(f.crop ?? "");
      const soilKey = toSoilKey(f.soil);
      const est = computeEstimate({
        areaHa: f.area_ha ?? 1,
        crop: cropKey,
        soil: soilKey,
        tempC: conds.tempC,
        humidity: conds.humidity,
        rainfallMm: conds.rainfallMm,
        sunlightHours: conds.sunlightHours,
        soilMoisture: conds.soilMoisture,
      });
      return {
        id: f.id ?? String(i),
        name: f.name ?? `Field #${i + 1}`,
        crop: f.crop ?? "Unknown",
        areaHa: f.area_ha ?? 1,
        yieldKgPerHa: Math.round(est.yieldTonsPerHa * 1000),
        yieldTotalTons: est.yieldTotalTons,
        efficiency: est.efficiencyScore,
        urgency: est.urgency,
        waterM3: Math.round(est.weeklyLitersTotal / 100) / 10,
      };
    });
  }, [rawFields, conds]);

  const chartData = predictions.map((p) => ({
    name: p.name.length > 10 ? p.name.slice(0, 9) + "…" : p.name,
    "Yield (t)": p.yieldTotalTons,
    fullName: p.name,
  }));

  const totalTons = predictions.reduce((s, p) => s + p.yieldTotalTons, 0);
  const avgEff    = predictions.length
    ? Math.round(predictions.reduce((s, p) => s + p.efficiency, 0) / predictions.length)
    : 0;
  const maxYield  = Math.max(...predictions.map((p) => p.yieldKgPerHa), 1);

  const set = <K extends keyof Conditions>(k: K, v: number) =>
    setConds((p) => ({ ...p, [k]: v }));

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <Cpu className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("page.yieldPrediction.signinPrompt")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold">
              <Cpu className="mb-1 mr-1 inline h-6 w-6 text-primary" />
              {t("page.yieldPrediction.title")}
            </h1>
            <Badge variant="secondary" className="font-mono text-xs">
              Random Forest &middot; O(T&middot;log n)
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("page.yieldPrediction.description")}
          </p>
        </div>

        {/* Live weather button */}
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchWeather}
            disabled={weatherLoading}
            className="gap-2"
          >
            {weatherLoading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <CloudSun className="h-4 w-4 text-amber-500" />}
            {weatherLoading ? t("common.loading") : "Live Weather"}
          </Button>
          {city && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" /> {city}
            </span>
          )}
          {weatherError && (
            <span className="text-[11px] text-destructive">{weatherError}</span>
          )}
        </div>
      </div>

      {/* ── Conditions ── */}
      <Card className="shadow-soft">
        <CardHeader className="cursor-pointer pb-2" onClick={() => setShowConds((p) => !p)}>
          <CardTitle className="flex items-center justify-between text-sm font-semibold">
            <span className="flex items-center gap-1.5">
              <Info className="h-4 w-4 text-muted-foreground" /> {t("page.yieldPrediction.conditionTitle")}
            </span>
            {showConds ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
        </CardHeader>
        {showConds && (
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">{t("form.soilMoisture")} — {conds.soilMoisture}%</Label>
              <Slider min={10} max={70} step={1} value={[conds.soilMoisture]}
                onValueChange={([v]) => set("soilMoisture", v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("form.avgTemperature")} — {conds.tempC}°C</Label>
              <Slider min={10} max={45} step={1} value={[conds.tempC]}
                onValueChange={([v]) => set("tempC", v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("form.rainfall")} — {conds.rainfallMm} mm</Label>
              <Slider min={0} max={100} step={1} value={[conds.rainfallMm]}
                onValueChange={([v]) => set("rainfallMm", v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("form.sunlight")} — {conds.sunlightHours} hr</Label>
              <Slider min={4} max={14} step={0.5} value={[conds.sunlightHours]}
                onValueChange={([v]) => set("sunlightHours", v)} />
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Summary stats ── */}
      {!loading && predictions.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="shadow-soft text-center">
            <CardContent className="pt-5 pb-4">
              <p className="text-2xl font-bold text-primary">{totalTons.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("page.yieldPrediction.summaryYieldTotal")}</p>
            </CardContent>
          </Card>
          <Card className="shadow-soft text-center">
            <CardContent className="pt-5 pb-4">
              <p className="text-2xl font-bold text-water">{predictions.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("page.yieldPrediction.summaryFieldsAnalysed")}</p>
            </CardContent>
          </Card>
          <Card className="shadow-soft text-center">
            <CardContent className="pt-5 pb-4">
              <p className="text-2xl font-bold text-soil">{avgEff}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("page.yieldPrediction.summaryAvgEfficiency")}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Per-field cards ── */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {t("page.yieldPrediction.predictedYields")} — {loading ? "…" : `${predictions.length} ${t("page.yieldPrediction.summaryFieldsAnalysed")}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("page.yieldPrediction.loadingFields")}
            </div>
          ) : predictions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("page.yieldPrediction.noFieldsYet")}<strong>{t("nav.fields")}</strong>.
            </p>
          ) : (
            predictions
              .slice()
              .sort((a, b) => b.yieldKgPerHa - a.yieldKgPerHa)
              .map((p, i) => {
                const barPct = Math.round((p.yieldKgPerHa / maxYield) * 100);
                const color  = CHART_COLORS[i % CHART_COLORS.length];
                return (
                  <div key={p.id} className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.crop} &middot; {p.areaHa} ha &middot; {p.waterM3} m³/week
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold leading-tight" style={{ color }}>
                          {p.yieldKgPerHa.toLocaleString()} kg/ha
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.yieldTotalTons.toFixed(2)} t total
                        </p>
                      </div>
                    </div>
                    {/* yield bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${barPct}%`, background: color }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{t("page.yieldPrediction.efficiencyScore").replace("{score}", String(p.efficiency))}</span>
                      <span className={
                        p.urgency === "CRITICAL" ? "text-destructive font-medium" :
                        p.urgency === "MODERATE" ? "text-amber-600 font-medium" :
                        "text-primary font-medium"
                      }>
                        {p.urgency === "CRITICAL" ? t("page.yieldPrediction.needsWaterNow") :
                         p.urgency === "MODERATE" ? t("page.yieldPrediction.waterSoon") : t("page.yieldPrediction.wellIrrigated")}
                      </span>
                    </div>
                  </div>
                );
              })
          )}
        </CardContent>
      </Card>

      {/* ── Bar chart ── */}
      {!loading && predictions.length > 0 && (
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" />
              {t("page.yieldPrediction.comparisonTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 150)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val: number) => [`${val.toFixed(2)} t`, t("page.yieldPrediction.tooltipYield")]}
                />
                <Bar dataKey="Yield (t)" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
