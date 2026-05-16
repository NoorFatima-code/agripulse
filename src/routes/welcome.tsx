import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mic, LayoutDashboard, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { updateUserProfile } from "@/integrations/supabase/database";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Choose your mode — AgriPulse" },
      { name: "description", content: "Pick a simple voice-first mode or the full dashboard." },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const { user, loading } = useAuth();
  const { lang } = useI18n();
  const navigate = useNavigate();
  const [picking, setPicking] = useState<"simple" | "pro" | null>(null);

  useEffect(() => {
    if (loading) return;
    // If user already chose a mode in this browser, send them there
    const stored = typeof window !== "undefined" ? localStorage.getItem("agripulse.mode") : null;
    if (stored === "simple") navigate({ to: "/simple" });
    else if (stored === "pro") navigate({ to: "/" });
  }, [loading, navigate]);

  const tx = (en: string, ur: string, _pa?: string) => (lang === "ur" ? ur : en);

  const choose = async (mode: "simple" | "pro") => {
    setPicking(mode);
    try {
      localStorage.setItem("agripulse.mode", mode);
      if (user) {
        await updateUserProfile(user.id, { ui_mode: mode });
      }
      navigate({ to: mode === "simple" ? "/simple" : "/" });
    } finally {
      setPicking(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/10 via-background to-background px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="text-center">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-leaf text-white shadow-glow">
            🌾
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">
            {tx("How would you like to use AgriPulse?", "آپ ایگری پلس کیسے استعمال کرنا چاہیں گے؟", "आप एग्रीपल्स कैसे इस्तेमाल करना चाहेंगे?")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {tx("Pick what fits you. You can change this later.", "اپنا انتخاب کریں۔ بعد میں بدل سکتے ہیں۔", "अपनी पसंद चुनें। बाद में बदल सकते हैं।")}
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => choose("simple")}
            disabled={picking !== null}
            className="group relative overflow-hidden rounded-3xl border-2 border-border bg-card p-8 text-left shadow-soft transition-all hover:-translate-y-1 hover:border-primary hover:shadow-elevated disabled:opacity-60"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-leaf text-white shadow-glow">
              <Mic className="h-8 w-8" />
            </div>
            <h2 className="mt-5 font-display text-2xl font-semibold">
              {tx("Simple", "آسان", "आसान")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {tx(
                "Just talk to your farm helper. Snap a photo of your crop. Hear advice in your language.",
                "اپنے مددگار سے بات کریں۔ فصل کی تصویر بھیجیں۔ اپنی زبان میں مشورہ سنیں۔",
                "अपने सहायक से बात करें। फसल की तस्वीर भेजें। अपनी भाषा में सलाह सुनें।",
              )}
            </p>
            <ul className="mt-4 space-y-1.5 text-sm">
              <li>🎙️ {tx("Voice chat", "آواز سے بات", "आवाज़ से बात")}</li>
              <li>📸 {tx("Photo diagnosis", "تصویر سے تشخیص", "तस्वीर से जाँच")}</li>
              <li>👆 {tx("Big buttons, no reading needed", "بڑے بٹن، پڑھنے کی ضرورت نہیں", "बड़े बटन, पढ़ने की ज़रूरत नहीं")}</li>
            </ul>
            {picking === "simple" && (
              <Loader2 className="absolute right-4 top-4 h-5 w-5 animate-spin text-primary" />
            )}
          </button>

          <button
            onClick={() => choose("pro")}
            disabled={picking !== null}
            className="group relative overflow-hidden rounded-3xl border-2 border-border bg-card p-8 text-left shadow-soft transition-all hover:-translate-y-1 hover:border-primary hover:shadow-elevated disabled:opacity-60"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LayoutDashboard className="h-8 w-8" />
            </div>
            <h2 className="mt-5 font-display text-2xl font-semibold">
              {tx("Pro Dashboard", "ماہر مرکزی صفحہ", "प्रो डैशबोर्ड")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {tx(
                "Full estimator with charts, water savings, yield forecast and PDF reports.",
                "نمودار، پانی کی بچت، پیداوار کا تخمینہ اور پی ڈی ایف رپورٹس کے ساتھ مکمل اندازہ۔",
                "चार्ट, पानी की बचत, पैदावार और पीडीएफ रिपोर्ट के साथ पूरा अनुमानक।",
              )}
            </p>
            <ul className="mt-4 space-y-1.5 text-sm">
              <li>📊 {tx("Charts & analytics", "نمودار اور تجزیہ", "चार्ट और विश्लेषण")}</li>
              <li>🧮 {tx("Precise FAO-56 calculations", "درست FAO-56 حساب", "सटीक FAO-56 गणना")}</li>
              <li>📄 {tx("Exportable PDF reports", "برآمد کے قابل پی ڈی ایف رپورٹس", "पीडीएफ रिपोर्ट")}</li>
            </ul>
            {picking === "pro" && (
              <Loader2 className="absolute right-4 top-4 h-5 w-5 animate-spin text-primary" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
