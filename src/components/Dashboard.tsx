import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays, Leaf, Download, Wand as Wand2, File as FileEdit,
  Gauge, Scale, Wheat, ArrowRight, Mic, Sparkles, Sprout,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { computeEstimate, CROPS, SAMPLE_PRESETS, type FarmInputs } from "@/lib/agronomy";
import { exportReport } from "@/lib/exportReport";
import heroImage from "@/assets/hero-irrigation.jpg";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { insertNotification } from "@/integrations/supabase/database";

const DEFAULT_INPUT: FarmInputs = SAMPLE_PRESETS[0].input;
let SHARED_INPUT: FarmInputs = DEFAULT_INPUT;

export type DashboardView = "home" | "inputs" | "results" | "charts";

export function Dashboard({
  showHero = true,
  view = "home",
}: {
  showHero?: boolean;
  view?: DashboardView;
}) {
  const [input, setInputState] = useState<FarmInputs>(SHARED_INPUT);
  const setInput = (next: FarmInputs) => { SHARED_INPUT = next; setInputState(next); };
  const estimate = useMemo(() => computeEstimate(input), [input]);
  const { user } = useAuth();
  const { t, lang, dir } = useI18n();

  const handleSample = () => {
    const random = SAMPLE_PRESETS[Math.floor(Math.random() * SAMPLE_PRESETS.length)];
    setInput(random.input);
    toast.success(t("toast.loadedPreset") + `: ${random.name[lang]}`);
  };

  const handleExport = async () => {
    exportReport(input);
    toast.success(t("toast.reportExported"));
    if (user) {
      await insertNotification({
        user_id: user.id,
        title: t("notifications.reportExportedTitle"),
        body: `${t("notifications.reportExportedBodyPrefix")} ${estimate.yieldTotalTons.toFixed(1)} ٹن · ${(estimate.dailyLitersTotal / 1000).toFixed(1)} مکعب میٹر/دن`,
        type: "success",
      });
    }
  };

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (view === "home" && showHero) {
    const isRtl = dir === "rtl";
    return (
      <div className="bg-background">
        <section className="mx-auto max-w-7xl px-4 pt-6 pb-10 sm:px-6 sm:pt-10">
          <div className="mb-6 flex justify-center">
            <Badge variant="outline" className="gap-1.5 rounded-full border-primary/30 bg-primary/5 px-3 py-1 text-primary">
              <Sparkles className="h-3 w-3" /> {t("home.badge")}
            </Badge>
          </div>

          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              {t("home.title.a")}{" "}
              <span className="bg-gradient-hero bg-clip-text text-transparent">
                {t("home.title.b")}
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
              {t("home.subtitle")}
            </p>
          </div>

          <div className="relative mx-auto mt-8 grid max-w-6xl gap-4 sm:mt-12 lg:grid-cols-[280px_1fr]">
            <div className="flex flex-col justify-between rounded-3xl bg-gradient-leaf p-6 text-white shadow-glow lg:min-h-[360px]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <Sprout className="h-6 w-6" />
              </div>
              <div className="mt-6">
                <p className="font-display text-xl font-semibold leading-tight">{t("home.cultivating.title")}</p>
                <p className="mt-2 text-sm text-white/85">{t("home.cultivating.body")}</p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl bg-card shadow-elevated lg:min-h-[360px]">
              <img
                src={heroImage}
                alt="Smart drip irrigation across a green farm"
                width={1600}
                height={900}
                className="h-full max-h-[420px] w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 flex flex-wrap items-start justify-center gap-2 p-5" dir="ltr">
                <span className="rounded-full bg-white/85 px-4 py-1.5 text-xs font-medium text-foreground shadow-soft backdrop-blur">{t("home.chip.smart")}</span>
                <span className="rounded-full bg-white/85 px-4 py-1.5 text-xs font-medium text-foreground shadow-soft backdrop-blur">{t("home.chip.sustainable")}</span>
                <span className="rounded-full bg-white/85 px-4 py-1.5 text-xs font-medium text-foreground shadow-soft backdrop-blur">{t("home.chip.innovative")}</span>
              </div>
              <div className="absolute inset-x-0 bottom-4 flex justify-center">
                <Button asChild size="lg" className="gap-2 rounded-full bg-foreground px-6 text-background shadow-elevated hover:bg-foreground/90">
                  <Link to="/estimator">
                    {t("home.explore")} <ArrowRight className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-2 rounded-full bg-gradient-leaf px-6 text-white shadow-glow hover:opacity-95">
              <Link to="/estimator"><FileEdit className="h-4 w-4" /> {t("home.cta.primary")}</Link>
            </Button>
            <Button size="lg" variant="outline" onClick={handleSample} className="gap-2 rounded-full px-6">
              <Wand2 className="h-4 w-4" /> {t("home.cta.secondary")}
            </Button>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title={t("dashboard.stat.crop")} value={CROPS[input.crop].displayLabel[lang]} description={t("dashboard.stat.selectedVariety")} />
            <StatCard title={t("dashboard.stat.estimatedYield")} value={`${estimate.yieldTotalTons.toFixed(1)} t`} description={t("dashboard.stat.projectedHarvest")} />
            <StatCard title={t("dashboard.stat.waterNeed")} value={`${(estimate.dailyLitersTotal / 1000).toFixed(1)} m³/day`} description={t("dashboard.stat.smartGoal")} />
            <StatCard title={t("dashboard.stat.efficiency")} value={`${estimate.efficiencyScore}%`} description={t("dashboard.stat.performanceScore")} />
          </div>

          <div className="mt-10 rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">{t("home.explore")}</p>
                <h3 className="text-2xl font-semibold tracking-tight text-foreground">{t("dashboard.banner.title")}</h3>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  {t("dashboard.banner.body")}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <FeaturePill icon={Scale} title={t("dashboard.feature.waterOptimization")} />
                <FeaturePill icon={CalendarDays} title={t("dashboard.feature.scheduleInsights")} />
                <FeaturePill icon={Gauge} title={t("dashboard.feature.yieldForecasting")} />
              </div>
            </div>
          </div>
        </section>

          <section className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">{t("dashboard.section.estimatorTools")}</p>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{t("dashboard.section.keyWorkflows")}</h2>
              </div>
              <Button asChild size="sm" variant="outline" className="rounded-full px-5">
                <Link to="/estimator">{t("dashboard.button.startFullEstimation")}</Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ModuleCard to="/simple"           icon={Mic}         title={t("nav.simple")}    text={t("home.module.simple")} highlight />
              <ModuleCard to="/estimator"         icon={Scale}       title={t("dashboard.module.waterAllocation.title")}   text={t("dashboard.module.waterAllocation.text")} />
              <ModuleCard to="/estimator/results" icon={CalendarDays} title={t("dashboard.module.irrigationSchedule.title")} text={t("dashboard.module.irrigationSchedule.text")} />
              <ModuleCard to="/estimator/charts"  icon={Gauge}       title={t("dashboard.module.yieldPrediction.title")}   text={t("dashboard.module.yieldPrediction.text")} />
            </div>
          </section>
        </div>
    );
  }

  // ── ESTIMATOR VIEWS (legacy — routes now use dedicated pages) ─────────────
  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6">
      <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
    </div>
  );
}

// ── Module card ───────────────────────────────────────────────────────────────
function ModuleCard({
  to, icon: Icon, title, text, highlight = false,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  highlight?: boolean;
}) {
  return (
    <Link to={to} className={`group flex flex-col gap-4 rounded-3xl border p-6 shadow-soft transition-transform hover:-translate-y-0.5 hover:shadow-elevated ${
      highlight ? "border-primary/30 bg-primary/5" : "border-border bg-card"
    }`}>
      <div className={`flex h-12 w-12 items-center justify-center rounded-3xl ${
        highlight ? "bg-primary text-white" : "bg-muted text-primary"
      }`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="space-y-2">
        <p className="text-base font-semibold leading-tight text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
      <div className="mt-auto flex items-center gap-2 text-sm font-medium text-primary">
        <span>Open</span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

function StatCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function FeaturePill({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 shadow-soft ring-1 ring-border">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
    </div>
  );
}

// Re-export for any existing import
export { ModuleCard };
