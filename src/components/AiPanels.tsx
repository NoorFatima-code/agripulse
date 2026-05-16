import { useState } from "react";
import { Loader2, Sparkles, Droplets, Wheat, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import {
  fetchYieldPrediction,
  fetchWaterSchedule,
  toApiCrop,
  type ApiField,
  type YieldPredictionData,
  type WaterScheduleData,
} from "@/lib/agripulseApi";
import type { FarmInputs } from "@/lib/agronomy";

// ────────────────────────────────────────────────────────────────
// Yield Prediction (used on Results page) — single field
// ────────────────────────────────────────────────────────────────
export function AiYieldPanel({ input, fieldName = "My Field" }: { input: FarmInputs; fieldName?: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<YieldPredictionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const apiField: ApiField = {
        name: fieldName,
        crop: toApiCrop(input.crop),
        area_ha: input.areaHa,
        soil_moisture_percent: input.soilMoisture,
        temperature_c: input.tempC,
        rainfall_mm: input.rainfallMm,
      };
      const res = await fetchYieldPrediction([apiField]);
      setData(res);
      toast.success("AI yield prediction ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-surface shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> AI Yield Prediction
          </CardTitle>
          <Button size="sm" onClick={run} disabled={loading} className="gap-1.5 bg-gradient-leaf text-white">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wheat className="h-3.5 w-3.5" />}
            Run analysis
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Random Forest simulation via AgriPulse API</p>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {!data && !error && !loading && (
          <p className="text-sm text-muted-foreground">Click "Run analysis" to call the backend algorithm.</p>
        )}
        {data && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Predicted yield" value={`${(data.predictions[0]?.predicted_yield_kg ?? 0).toLocaleString()} kg`} />
              <Stat label="Per hectare" value={`${data.predictions[0]?.yield_per_ha ?? 0} kg/ha`} />
              <Stat label="Model R²" value={data.model_r2.toFixed(2)} />
            </div>
            <p className="text-sm text-foreground">{data.summary}</p>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Feature importances</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.feature_importances} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 150)" vertical={false} />
                  <XAxis dataKey="feature" fontSize={11} stroke="oklch(0.55 0.03 150)" tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} stroke="oklch(0.55 0.03 150)" tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="importance" fill="oklch(0.55 0.14 145)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px]">
              <Badge variant="outline">Train: {data.complexity_train}</Badge>
              <Badge variant="outline">Predict: {data.complexity_predict}</Badge>
              <Badge variant="outline">MAE: {data.model_mae_kg} kg</Badge>
            </div>
            {data.predictions[0]?.top_factor && (
              <p className="text-xs text-muted-foreground">Top factor: {data.predictions[0].top_factor}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────
// Water Schedule (used on MyFields page) — multi field
// ────────────────────────────────────────────────────────────────
export function AiSchedulePanel({ fields }: { fields: ApiField[] }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WaterScheduleData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (fields.length === 0) { toast.error("Add fields first"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetchWaterSchedule(fields);
      setData(res);
      toast.success(`Scheduled ${res.fields_to_water} field(s)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-surface shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> AI Water Schedule (Greedy)
          </CardTitle>
          <Button size="sm" onClick={run} disabled={loading || fields.length === 0} className="gap-1.5 bg-gradient-leaf text-white">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Droplets className="h-3.5 w-3.5" />}
            Run schedule
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Sends {fields.length} field(s) to the AgriPulse API. Uses default moisture/temperature/rainfall per field.
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {data && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Fields to water" value={String(data.fields_to_water)} />
              <Stat label="Total water" value={`${data.total_water_liters.toLocaleString()} L`} />
              <Stat label="Skipped" value={String(data.skipped.length)} />
            </div>
            <p className="text-sm">{data.summary}</p>
            <div className="space-y-2">
              {data.schedule.map((s) => (
                <div key={s.rank} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
                  <div>
                    <p className="font-medium">#{s.rank} {s.name} <span className="text-xs text-muted-foreground">· {s.crop}</span></p>
                    <p className="text-xs text-muted-foreground">
                      Moisture {s.moisture_pct}% (threshold {s.threshold_pct}%) · {s.area_ha} ha
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-water">{s.water_liters.toLocaleString()} L</p>
                    <Badge variant={s.urgency === "critical" ? "destructive" : "outline"} className="text-[10px] uppercase">
                      {s.urgency}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-[10px]">
              <Badge variant="outline">{data.complexity_time}</Badge>
              <Badge variant="outline">Space {data.complexity_space}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{data.complexity_explanation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
