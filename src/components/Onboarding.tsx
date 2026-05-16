import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Droplets, Mic, BarChart3, Leaf } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const features = [
  {
    icon: Droplets,
    en: { title: "Smart watering advice", desc: "Know exactly when to water your crop" },
    ur: { title: "ذہین آبپاشی مشورہ", desc: "جانیں کب فصل کو پانی دینا ہے" },
  },
  {
    icon: Mic,
    en: { title: "Voice & photo assistant", desc: "Ask in Urdu or English, get instant help" },
    ur: { title: "آواز اور تصویر معاون", desc: "اردو یا انگریزی میں پوچھیں، فوری مدد پائیں" },
  },
  {
    icon: BarChart3,
    en: { title: "Yield & irrigation planning", desc: "Plan better, waste less water" },
    ur: { title: "پیداوار اور آبپاشی منصوبہ", desc: "بہتر منصوبہ بنائیں، پانی بچائیں" },
  },
];

const LANGS = [
  { code: "en", label: "English", native: "English" },
  { code: "ur", label: "Urdu", native: "اردو" },
];

export function Onboarding() {
  const { lang, setLang } = useI18n();
  const [selected, setSelected] = useState<"en" | "ur">(lang as "en" | "ur");
  const ur = selected === "ur";

  const handleLangSelect = (code: "en" | "ur") => {
    setSelected(code);
    setLang(code);
  };

  return (
   <div
  className="flex h-screen flex-col overflow-hidden bg-[#14532d]"
  dir={ur ? "rtl" : "ltr"}
>

        {/* ── Hero (green) ── */}
        <div className="relative flex flex-col items-center justify-center px-8 py-5 text-center">

          {/* Leaf pattern overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5 Q45 20 30 35 Q15 20 30 5Z' fill='white'/%3E%3C/svg%3E")`,
              backgroundSize: "40px 40px",
            }}
          />

          {/* Logo */}
          <div className="relative mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <Leaf className="h-8 w-8 text-white" />
          </div>

          <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
            AgriPulse
          </h1>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/60">
            {ur ? "ذہین آبپاشی" : "Smart Irrigation"}
          </p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/70">
            {ur ? "سمجھداری سے پانی دیں، بہتر اگائیں۔" : "Water smart, grow better."}
          </p>

          {/* Language selector */}
          <div className="mt-4">
            <p className="mb-2 text-[11px] text-white/50">
              {ur ? "زبان منتخب کریں" : "Select language"}
            </p>
            <div className="flex gap-2">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => handleLangSelect(l.code as "en" | "ur")}
                  className={`flex flex-col items-center gap-0.5 rounded-xl px-5 py-2 text-sm font-medium transition-all active:scale-95 ${
                    selected === l.code
                      ? "bg-white text-[#14532d] shadow-lg"
                      : "bg-white/15 text-white ring-1 ring-white/20 hover:bg-white/25"
                  }`}
                >
                  <span className="text-sm">{l.native}</span>
                  <span className={`text-[10px] ${selected === l.code ? "text-[#14532d]/60" : "text-white/50"}`}>
                    {l.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom white sheet ── */}
        <div className="flex flex-1 flex-col rounded-t-3xl bg-white px-6 pb-8 pt-6">

          <p className="mb-4 text-center text-base font-medium text-gray-800">
            {ur ? "خوش آمدید، کسان" : "Welcome, farmer"}
          </p>

          {/* Features */}
          <div className="space-y-2.5">
            {features.map((f, i) => {
              const copy = ur ? f.ur : f.en;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-[#f8faf6] px-4 py-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dcfce7]">
                    <f.icon className="h-4 w-4 text-[#15803d]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{copy.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{copy.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* CTA */}
          <Link
            to="/auth"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#14532d] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#166534] active:scale-[0.98]"
          >
            {ur ? "شروع کریں" : "Get started"}
            <ArrowRight className="h-4 w-4" />
          </Link>

          <p className="mt-3 text-center text-xs text-gray-400">
            {ur ? "پہلے سے اکاؤنٹ ہے؟ " : "Already have an account? "}
            <Link to="/auth" className="font-medium text-[#15803d] hover:underline">
              {ur ? "سائن ان کریں" : "Sign in"}
            </Link>
          </p>
        </div>

      </div>
  );
}
