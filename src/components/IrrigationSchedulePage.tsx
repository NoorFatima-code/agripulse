import { useState, useEffect, useMemo } from "react";
import {
  CalendarDays, Play, Loader2, Info, ChevronDown, ChevronUp,
  Droplets, AlertTriangle, CheckCircle2, Clock, CloudSun, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { getUserFields } from "@/integrations/supabase/database";
import { useAuth } from "@/lib/auth";
import { computeEstimate, type CropKey, type SoilKey } from "@/lib/agronomy";
import { useI18n } from "@/lib/i18n";
import { useWeather } from "@/hooks/useWeather";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

interface ScheduleField {
  id: string;
  name: string;
  crop: string;
  areaHa: number;
  moisture: number;      // % — lower = more urgent
  urgency: "CRITICAL" | "MODERATE" | "NONE";
  day: number | null;    // assigned day (1-based), null = not yet assigned
  waterNeedL: number;
}

interface Conditions {
  soilMoisture: number;
  tempC: number;
  rainfallMm: number;
  sunlightHours: number;
  humidity: number;
}

const DEFAULT_CONDITIONS: Conditions = {
  soilMoisture: 28,
  tempC: 26,
  rainfallMm: 8,
  sunlightHours: 8,
  humidity: 60,
};

const URGENCY_CONFIG = {
  CRITICAL: { label: "Critical",  color: "text-destructive", bg: "bg-destructive/10", bar: "bg-destructive" },
  MODERATE: { label: "Moderate",  color: "text-amber-600",   bg: "bg-amber-50",       bar: "bg-amber-400" },
  NONE:     { label: "OK",        color: "text-primary",     bg: "bg-primary/5",      bar: "bg-primary" },
};

// ─── component ───────────────────────────────────────────────────────────────
export function IrrigationSchedulePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { fetchWeather, loading: weatherLoading, city, conditions: weatherConds, error: weatherError } = useWeather();
  const [loading, setLoading]     = useState(true);
  const [rawFields, setRawFields] = useState<any[]>([]);
  const [conds, setConds]         = useState<Conditions>(DEFAULT_CONDITIONS);
  const [showConds, setShowConds] = useState(false);
  const [slotsPerDay, setSlotsPerDay] = useState(3);
  const [schedule, setSchedule]   = useState<ScheduleField[]>([]);
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

  // Build field objects with moisture estimates
  const baseFields = useMemo<ScheduleField[]>(() => {
    return rawFields.map((f, i) => {
      const cropKey = toCropKey(f.crop ?? "");
      const soilKey = toSoilKey(f.soil);

      // Estimate moisture: if last_watered_at exists, decay from 70% over 7 days;
      // otherwise use the global conditions slider
      let moisture = conds.soilMoisture;
      if (f.last_watered_at) {
        const daysAgo = (Date.now() - new Date(f.last_watered_at).getTime()) / 86400000;
        moisture = Math.max(10, Math.round(70 - daysAgo * 8));
      }

      const est = computeEstimate({
        areaHa: f.area_ha ?? 1,
        crop: cropKey,
        soil: soilKey,
        tempC: conds.tempC,
        humidity: conds.humidity,
        rainfallMm: conds.rainfallMm,
        sunlightHours: conds.sunlightHours,
        soilMoisture: moisture,
      });

      return {
        id: f.id ?? String(i),
        name: f.name ?? `Field #${i + 1}`,
        crop: f.crop ?? "Unknown",
        areaHa: f.area_ha ?? 1,
        moisture,
        urgency: est.urgency,
        day: null,
        waterNeedL: est.weeklyLitersTotal,
      };
    });
  }, [rawFields, conds]);

  const runGreedy = () => {
    if (baseFields.length === 0) {
      toast.error(t("page.irrigationSchedule.noFieldsYet") + t("nav.fields"));
      return;
    }
    // Greedy: sort ascending by moisture (driest first) — O(n log n)
    const sorted = [...baseFields].sort((a, b) => a.moisture - b.moisture);
    const result: ScheduleField[] = sorted.map((f, i) => ({
      ...f,
      day: Math.floor(i / slotsPerDay) + 1,
    }));
    setSchedule(result);
    setRan(true);
  };

  const set = <K extends keyof Conditions>(k: K, v: number) =>
    setConds((p) => ({ ...p, [k]: v }));

  // Group by day for display
  const byDay = useMemo(() => {
    const map = new Map<number, ScheduleField[]>();
    schedule.forEach((f) => {
      if (f.day === null) return;
      if (!map.has(f.day)) map.set(f.day, []);
      map.get(f.day)!.push(f);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [schedule]);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <CalendarDays className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("page.irrigationSchedule.signinPrompt")}</p>
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
              <CalendarDays className="mb-1 mr-1 inline h-6 w-6 text-primary" />
              {t("page.irrigationSchedule.title")}
            </h1>
            <Badge variant="secondary" className="font-mono text-xs">
              {t("page.irrigationSchedule.badge")}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("page.irrigationSchedule.description")}
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
              <Info className="h-4 w-4 text-muted-foreground" /> {t("page.irrigationSchedule.farmConditions")}
            </span>
            {showConds ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
        </CardHeader>
        {showConds && (
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">{t("page.irrigationSchedule.defaultSoilMoisture").replace("{moisture}", String(conds.soilMoisture))}
                <span className="ml-1 text-muted-foreground">{t("page.irrigationSchedule.noHistoryNote")}</span>
              </Label>
              <Slider min={10} max={70} step={1} value={[conds.soilMoisture]}
                onValueChange={([v]) => set("soilMoisture", v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("page.irrigationSchedule.temperature").replace("{temp}", String(conds.tempC))}</Label>
              <Slider min={10} max={45} step={1} value={[conds.tempC]}
                onValueChange={([v]) => set("tempC", v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("page.irrigationSchedule.rainfall").replace("{rain}", String(conds.rainfallMm))}</Label>
              <Slider min={0} max={100} step={1} value={[conds.rainfallMm]}
                onValueChange={([v]) => set("rainfallMm", v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("page.irrigationSchedule.sunlight").replace("{hours}", String(conds.sunlightHours))}</Label>
              <Slider min={4} max={14} step={0.5} value={[conds.sunlightHours]}
                onValueChange={([v]) => set("sunlightHours", v)} />
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Slots + Run ── */}
      <Card className="shadow-soft">
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="flex-1 space-y-1.5 min-w-[160px]">
            <Label className="text-sm font-medium">{t("page.irrigationSchedule.slotsPerDay")}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={20}
                step={1}
                value={slotsPerDay}
                onChange={(e) => setSlotsPerDay(Math.max(1, Number(e.target.value) || 1))}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">{t("page.irrigationSchedule.fieldsPerDay")}</span>
            </div>
            {baseFields.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {t("page.irrigationSchedule.daysNeeded")
                  .replace("{fields}", String(baseFields.length))
                  .replace("{days}", String(Math.ceil(baseFields.length / slotsPerDay)))}
              </p>
            )}
          </div>
          <Button
            onClick={runGreedy}
            disabled={loading || baseFields.length === 0}
            className="bg-primary gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {t("page.irrigationSchedule.generateSchedule")}
          </Button>
        </CardContent>
      </Card>

      {/* ── Fields list (pre-run) ── */}
      {!ran && (
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              {t("page.irrigationSchedule.fieldsAvailableCount").replace("{count}", loading ? "…" : String(baseFields.length))}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("page.irrigationSchedule.fieldsAvailableCount").replace("{count}", "…")}
              </div>
            ) : baseFields.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("page.irrigationSchedule.noFieldsYet")}<strong>{t("nav.fields")}</strong>.
              </p>
            ) : (
              baseFields.map((f) => {
                const cfg = URGENCY_CONFIG[f.urgency];
                return (
                  <div key={f.id} className={cn("flex items-center justify-between rounded-xl border px-4 py-3", cfg.bg)}>
                    <div className="flex items-center gap-3">
                      <Droplets className="h-4 w-4 shrink-0 text-water" />
                      <div>
                        <p className="text-sm font-medium">{f.name}</p>
                        <p className="text-[11px] text-muted-foreground">{f.crop} &middot; {f.areaHa} ha</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <div className={cn("h-full rounded-full", cfg.bar)}
                              style={{ width: `${f.moisture}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{f.moisture}%</span>
                        </div>
                      </div>
                      <Badge className={cn("text-[10px]", cfg.color, cfg.bg, "border-0")} variant="outline">
                        {cfg.label}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Schedule result ── */}
      {ran && byDay.map(([day, dayFields]) => (
        <Card key={day} className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-primary" />
              {t("page.irrigationSchedule.dayBadge").replace("{plural}", String(day))} {day}
              <Badge variant="secondary" className="text-xs">{dayFields.length} {t("page.irrigationSchedule.fieldBadge").replace("{plural}", "")}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dayFields.map((f, rank) => {
              const cfg = URGENCY_CONFIG[f.urgency];
              return (
                <div key={f.id} className={cn("flex items-center justify-between rounded-xl border px-4 py-3", cfg.bg)}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      {rank + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{f.name}</p>
                      <p className="text-[11px] text-muted-foreground">{f.crop} &middot; {f.areaHa} ha</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-full rounded-full", cfg.bar)}
                            style={{ width: `${f.moisture}%` }} />
                        </div>
                        <span className="text-muted-foreground">{f.moisture}%</span>
                      </div>
                      <p className="mt-0.5 text-muted-foreground">{(f.waterNeedL / 1000).toFixed(1)} m³</p>
                    </div>
                    <Badge className={cn("text-[10px]", cfg.color, cfg.bg, "border-0")} variant="outline">
                      {cfg.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {ran && (
        <Card className="border-primary/30 bg-primary/5 shadow-soft">
          <CardContent className="pt-5">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{schedule.filter((f) => f.urgency === "CRITICAL").length}</p>
                <p className="text-xs text-muted-foreground">{t("page.irrigationSchedule.criticalFields")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{byDay.length}</p>
                <p className="text-xs text-muted-foreground">{t("page.irrigationSchedule.daysToIrrigate")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-water">
                  {(schedule.reduce((s, f) => s + f.waterNeedL, 0) / 1000).toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">{t("page.irrigationSchedule.totalWater")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
