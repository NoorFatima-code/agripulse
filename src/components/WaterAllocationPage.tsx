import { useState, useEffect, useMemo } from "react";
import {
  Droplets, Play, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Loader2, Info, Scale, CloudSun, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { getUserFields } from "@/integrations/supabase/database";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useWeather } from "@/hooks/useWeather";
import { computeEstimate, CROPS, SOILS, type CropKey, type SoilKey } from "@/lib/agronomy";
import { toast } from "sonner";

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

interface FieldItem {
  id: string;
  name: string;
  crop: string;
  cropKey: CropKey;
  soilKey: SoilKey;
  areaHa: number;
  waterNeedL: number;   // litres per session
  predictedYieldKg: number;
}

interface Conditions {
  soilMoisture: number;
  tempC: number;
  rainfallMm: number;
  sunlightHours: number;
  humidity: number;
}

const DEFAULT_CONDITIONS: Conditions = {
  soilMoisture: 30,
  tempC: 26,
  rainfallMm: 10,
  sunlightHours: 8,
  humidity: 60,
};

// 0/1 Knapsack DP (unit = 1 m³ = 1000 L)
function knapsack(items: FieldItem[], budgetM3: number): boolean[] {
  const W = Math.max(1, Math.round(budgetM3));
  const n = items.length;
  const weights = items.map((f) => Math.max(1, Math.round(f.waterNeedL / 1000)));
  const values  = items.map((f) => Math.round(f.predictedYieldKg));

  // Use flat array for performance
  const dp = new Float64Array((n + 1) * (W + 1));
  const idx = (i: number, w: number) => i * (W + 1) + w;

  for (let i = 1; i <= n; i++) {
    const wi = weights[i - 1];
    const vi = values[i - 1];
    for (let w = 0; w <= W; w++) {
      dp[idx(i, w)] = dp[idx(i - 1, w)];
      if (w >= wi) {
        const candidate = dp[idx(i - 1, w - wi)] + vi;
        if (candidate > dp[idx(i, w)]) dp[idx(i, w)] = candidate;
      }
    }
  }

  // Back-track selected items
  const selected = new Array<boolean>(n).fill(false);
  let cap = W;
  for (let i = n; i >= 1; i--) {
    if (dp[idx(i, cap)] !== dp[idx(i - 1, cap)]) {
      selected[i - 1] = true;
      cap -= weights[i - 1];
    }
  }
  return selected;
}

// ─── component ───────────────────────────────────────────────────────────────
export function WaterAllocationPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { fetchWeather, loading: weatherLoading, city, conditions: weatherConds, error: weatherError } = useWeather();
  const [loading, setLoading]     = useState(true);
  const [rawFields, setRawFields] = useState<any[]>([]);
  const [conds, setConds]         = useState<Conditions>(DEFAULT_CONDITIONS);
  const [showConds, setShowConds] = useState(false);
  const [budgetM3, setBudgetM3]   = useState(20);
  const [selected, setSelected]   = useState<boolean[]>([]);
  const [ran, setRan]             = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getUserFields(user.id).then(({ data }) => {
      setRawFields(data ?? []);
      setLoading(false);
    });
  }, [user?.id]);

  // When weather data arrives, apply it to conditions
  useEffect(() => {
    if (weatherConds) {
      setConds(weatherConds);
      toast.success(`Live weather loaded — ${city}`);
    }
  }, [weatherConds]);

  const fields = useMemo<FieldItem[]>(() => {
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
        cropKey,
        soilKey,
        areaHa: f.area_ha ?? 1,
        waterNeedL: est.weeklyLitersTotal,
        predictedYieldKg: Math.round(est.yieldTotalTons * 1000),
      };
    });
  }, [rawFields, conds]);

  const totalNeedM3 = fields.reduce((s, f) => s + f.waterNeedL / 1000, 0);

  const runKnapsack = () => {
    if (fields.length === 0) {
      toast.error(t("page.waterAllocation.noFieldsYet") + t("page.waterAllocation.selectMyFields"));
      return;
    }
    const result = knapsack(fields, budgetM3);
    setSelected(result);
    setRan(true);
  };

  const selFields   = fields.filter((_, i) => selected[i]);
  const unselFields = fields.filter((_, i) => !selected[i]);
  const usedM3      = selFields.reduce((s, f) => s + f.waterNeedL / 1000, 0);
  const totalYieldKg = selFields.reduce((s, f) => s + f.predictedYieldKg, 0);

  const set = <K extends keyof Conditions>(k: K, v: number) =>
    setConds((p) => ({ ...p, [k]: v }));

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <Scale className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("page.waterAllocation.signinPrompt")}</p>
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
              <Droplets className="mb-1 mr-1 inline h-6 w-6 text-water" />
              {t("page.waterAllocation.title")}
            </h1>
            <Badge variant="secondary" className="font-mono text-xs">
              {t("page.waterAllocation.badge")}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("page.waterAllocation.description")}
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
              <Info className="h-4 w-4 text-muted-foreground" /> {t("page.waterAllocation.farmConditions")}
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

      {/* ── Budget + Run ── */}
      <Card className="shadow-soft">
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="flex-1 space-y-1.5 min-w-[160px]">
            <Label className="text-sm font-medium">{t("page.waterAllocation.totalWaterCapacity")}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                step={1}
                value={budgetM3}
                onChange={(e) => setBudgetM3(Math.max(1, Number(e.target.value) || 1))}
                className="w-36"
              />
              <span className="text-sm text-muted-foreground">m³</span>
            </div>
            {fields.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {t("page.waterAllocation.totalFieldNeed").replace("{need}", totalNeedM3.toFixed(1))}
              </p>
            )}
          </div>
          <Button
            onClick={runKnapsack}
            disabled={loading || fields.length === 0}
            className="bg-primary gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {t("page.waterAllocation.runButton")}
          </Button>
        </CardContent>
      </Card>

      {/* ── Fields ── */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {t("page.waterAllocation.fieldsAvailable")} ({loading ? "…" : fields.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("page.waterAllocation.loadingFields")}
            </div>
          ) : fields.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("page.waterAllocation.noFieldsYet")}
              <strong>{t("page.waterAllocation.selectMyFields")}</strong>.
            </p>
          ) : (
            fields.map((f, i) => {
              const isSelected = ran ? selected[i] : null;
              return (
                <div
                  key={f.id}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${
                    isSelected === true
                      ? "border-primary/50 bg-primary/5"
                      : isSelected === false
                      ? "border-border/40 bg-muted/30 opacity-60"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isSelected === true && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                    {isSelected === false && <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    {isSelected === null && <Droplets className="h-4 w-4 shrink-0 text-water" />}
                    <div>
                      <p className="text-sm font-medium">{f.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {f.crop} &middot; {f.areaHa} ha
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground space-y-0.5">
                    <p className="font-medium text-foreground">{(f.waterNeedL / 1000).toFixed(1)} m³</p>
                    <p>{(f.predictedYieldKg / 1000).toFixed(2)} {t("page.waterAllocation.tonsPredictedYield")}</p>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* ── Result ── */}
      {ran && selected.length > 0 && (
        <Card className="border-primary/30 bg-primary/5 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-primary">
              <CheckCircle2 className="h-4 w-4" /> {t("page.waterAllocation.optimalResult")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{selFields.length}</p>
                <p className="text-xs text-muted-foreground">{t("page.waterAllocation.fieldsSelected")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-water">{usedM3.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">{usedM3.toFixed(1)} m³ {t("page.waterAllocation.usedOf")} {budgetM3} m³</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-soil">{(totalYieldKg / 1000).toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">{t("page.waterAllocation.tonsPredictedYield")}</p>
              </div>
            </div>
            {unselFields.length > 0 && (
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                {unselFields.length} {t("page.waterAllocation.fieldsSkipped")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
