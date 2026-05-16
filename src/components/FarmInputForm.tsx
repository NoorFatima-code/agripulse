import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CROPS, SOILS, type FarmInputs } from "@/lib/agronomy";
import { useI18n } from "@/lib/i18n";
import { Droplets, Sprout, Thermometer, Sun, CloudRain, Maximize2 } from "lucide-react";

interface Props {
  value: FarmInputs;
  onChange: (next: FarmInputs) => void;
}

export function FarmInputForm({ value, onChange }: Props) {
  const { t, lang } = useI18n();
  const set = <K extends keyof FarmInputs>(k: K, v: FarmInputs[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sprout className="h-4 w-4 text-primary" />
          {t("form.title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("form.subtitle")}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
              {t("form.area")}
            </Label>
            <Input
              type="number"
              min={0.1}
              step={0.1}
              value={value.areaHa}
              onChange={(e) => set("areaHa", Math.max(0.1, parseFloat(e.target.value) || 0.1))}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">{t("form.cropType")}</Label>
            <Select value={value.crop} onValueChange={(v) => set("crop", v as FarmInputs["crop"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(CROPS).map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    <span className="mr-2">{c.emoji}</span>{c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label className="text-xs font-medium">{t("form.soilType")}</Label>
            <div className="grid grid-cols-4 gap-2">
              {Object.values(SOILS).map((s) => {
                const active = value.soil === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => set("soil", s.key)}
                    className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                      active
                        ? "border-primary bg-primary/10 text-primary shadow-soft"
                        : "border-border bg-background text-foreground hover:border-primary/40"
                    }`}
                  >
                      {s.displayLabel[lang]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-xl bg-muted/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("form.soilWeatherTitle")}
          </p>

          <SliderField
            icon={<Droplets className="h-3.5 w-3.5 text-[var(--water)]" />}
            label={t("form.soilMoisture")}
            value={value.soilMoisture}
            min={10}
            max={70}
            step={1}
            unit="%"
            onChange={(v) => set("soilMoisture", v)}
          />

          <SliderField
            icon={<Thermometer className="h-3.5 w-3.5 text-[var(--harvest)]" />}
            label={t("form.avgTemperature")}
            value={value.tempC}
            min={5}
            max={45}
            step={1}
            unit="°C"
            onChange={(v) => set("tempC", v)}
          />
          <SliderField
            icon={<Droplets className="h-3.5 w-3.5 text-[var(--water)]" />}
            label={t("form.humidity")}
            value={value.humidity}
            min={10}
            max={100}
            step={1}
            unit="%"
            onChange={(v) => set("humidity", v)}
          />
          <SliderField
            icon={<CloudRain className="h-3.5 w-3.5 text-[var(--water)]" />}
            label={t("form.rainfall")}
            value={value.rainfallMm}
            min={0}
            max={100}
            step={1}
            unit="mm"
            onChange={(v) => set("rainfallMm", v)}
          />
          <SliderField
            icon={<Sun className="h-3.5 w-3.5 text-[var(--harvest)]" />}
            label={t("form.sunlight")}
            value={value.sunlightHours}
            min={2}
            max={14}
            step={0.5}
            unit="h"
            onChange={(v) => set("sunlightHours", v)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  icon,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  icon: React.ReactNode;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-xs font-medium">
          {icon}
          {label}
        </Label>
        <span className="font-display text-sm font-semibold tabular-nums text-foreground">
          {value}
          <span className="ml-0.5 text-xs text-muted-foreground">{unit}</span>
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}
