import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Sprout, Droplets, Sun, Save, Wheat, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { speak, type VoiceLang } from "@/lib/voice";
import { toast } from "sonner";
import { callFarmAdvisor, logFarmReport } from "@/lib/farmAdvisor";

const CROPS = [
  { key: "wheat", emoji: "🌾", en: "Wheat", ur: "گندم", hi: "गेहूँ" },
  { key: "rice", emoji: "🌾", en: "Rice", ur: "چاول", hi: "चावल" },
  { key: "maize", emoji: "🌽", en: "Maize", ur: "مکئی", hi: "मक्का" },
  { key: "tomato", emoji: "🍅", en: "Tomato", ur: "ٹماٹر", hi: "टमाटर" },
  { key: "cotton", emoji: "🌱", en: "Cotton", ur: "کپاس", hi: "कपास" },
  { key: "sugarcane", emoji: "🎋", en: "Sugarcane", ur: "گنا", hi: "गन्ना" },
];

const SOILS = [
  { key: "sandy", emoji: "🏖️", en: "Sandy", ur: "ریتلی", hi: "रेतीली" },
  { key: "loamy", emoji: "🌾", en: "Loamy", ur: "زرخیز", hi: "दोमट" },
  { key: "clay", emoji: "🪨", en: "Clay", ur: "چکنی", hi: "चिकनी" },
];

const WATER = [
  { key: "dry", emoji: "🏜️", en: "Dry", ur: "خشک", hi: "सूखा" },
  { key: "okay", emoji: "💧", en: "Okay", ur: "ٹھیک", hi: "ठीक" },
  { key: "wet", emoji: "🌊", en: "Wet", ur: "گیلا", hi: "गीला" },
];

const SUNLIGHT = [
  { key: "low", emoji: "☁️", en: "Cloudy", ur: "بادل", hi: "बादल" },
  { key: "med", emoji: "🌤️", en: "Mixed", ur: "ملا", hi: "मिला" },
  { key: "high", emoji: "☀️", en: "Sunny", ur: "دھوپ", hi: "धूप" },
];

export function SimpleManual() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const navigate = useNavigate();
  const voiceLang = lang as VoiceLang;
  const [crop, setCrop] = useState<string>("");
  const [soil, setSoil] = useState<string>("");
  const [water, setWater] = useState<string>("");
  const [sun, setSun] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [advice, setAdvice] = useState<string>("");

  const tx = (en: string, ur: string, _pa?: string) => (lang === "ur" ? ur : en);

  const labelFor = (list: typeof CROPS, key: string) => {
    const item = list.find((i) => i.key === key);
    if (!item) return "";
    return tx(item.en, item.ur, item.hi);
  };

  const askAdvice = async () => {
    if (!crop) {
      toast.error(tx("Please pick a crop", "براہ کرم فصل چنیں", "कृपया फसल चुनें"));
      return;
    }
    setSaving(true);
    setAdvice("");
    try {
      const summary =
        `Crop: ${labelFor(CROPS, crop)}` +
        (soil ? `, Soil: ${labelFor(SOILS, soil)}` : "") +
        (water ? `, Water level: ${labelFor(WATER, water)}` : "") +
        (sun ? `, Weather: ${labelFor(SUNLIGHT, sun)}` : "") +
        `. Give one short, clear next step for the farmer.`;

      const { data, error } = await callFarmAdvisor({
        message: summary,
        language: lang
      });
      if (error) throw error;
      const reply: string = data?.reply ?? "";
      setAdvice(reply);
      speak(reply, voiceLang);

      if (user) {
        await logFarmReport({
          user_id: user.id,
          kind: "manual",
          crop: labelFor(CROPS, crop),
          note: summary,
          ai_response: reply,
          language: lang,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-primary/5 via-background to-background pb-20">
      <div className="flex items-center gap-2 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md">
        <Link to="/simple" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <p className="font-display text-base font-semibold">
          {tx("Quick farm details", "فوری تفصیلات", "त्वरित विवरण")}
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-6 px-4 pt-6">
        <PickerGroup
          icon={<Wheat className="h-4 w-4" />}
          title={tx("Choose crop", "فصل چنیں", "फसल चुनें")}
          items={CROPS.map((c) => ({ key: c.key, emoji: c.emoji, label: tx(c.en, c.ur, c.hi) }))}
          value={crop}
          onChange={setCrop}
        />
        <PickerGroup
          icon={<Sprout className="h-4 w-4" />}
          title={tx("Soil type", "مٹی کی قسم", "मिट्टी का प्रकार")}
          items={SOILS.map((c) => ({ key: c.key, emoji: c.emoji, label: tx(c.en, c.ur, c.hi) }))}
          value={soil}
          onChange={setSoil}
        />
        <PickerGroup
          icon={<Droplets className="h-4 w-4" />}
          title={tx("Soil water now", "اب مٹی کا پانی", "अभी मिट्टी का पानी")}
          items={WATER.map((c) => ({ key: c.key, emoji: c.emoji, label: tx(c.en, c.ur, c.hi) }))}
          value={water}
          onChange={setWater}
        />
        <PickerGroup
          icon={<Sun className="h-4 w-4" />}
          title={tx("Weather today", "آج کا موسم", "आज का मौसम")}
          items={SUNLIGHT.map((c) => ({ key: c.key, emoji: c.emoji, label: tx(c.en, c.ur, c.hi) }))}
          value={sun}
          onChange={setSun}
        />

        {advice && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {tx("Advice", "مشورہ", "सलाह")}
            </p>
            <p className="mt-2 text-[15px] leading-relaxed">{advice}</p>
            <button
              onClick={() => speak(advice, voiceLang)}
              className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              🔊 {tx("Listen", "سنیں", "सुनें")}
            </button>
          </div>
        )}

        <Button
          onClick={askAdvice}
          disabled={saving}
          size="lg"
          className="w-full gap-2 bg-gradient-leaf text-white shadow-glow"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {tx("Get advice", "مشورہ لیں", "सलाह लें")}
        </Button>
      </div>
    </div>
  );
}

function PickerGroup({
  title, items, value, onChange, icon,
}: {
  title: string;
  items: { key: string; emoji: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  icon: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => {
          const active = value === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 transition-all ${
                active
                  ? "border-primary bg-primary/10 shadow-soft"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <span className="text-3xl leading-none">{item.emoji}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
