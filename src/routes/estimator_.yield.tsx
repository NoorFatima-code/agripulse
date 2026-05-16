import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AiYieldPanel } from "@/components/AiPanels";
import { FarmInputForm } from "@/components/FarmInputForm";
import { SAMPLE_PRESETS, type FarmInputs } from "@/lib/agronomy";

function YieldPredictionPage() {
  const [input, setInput] = useState<FarmInputs>(SAMPLE_PRESETS[0].input);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-3 rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Yield Prediction</p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">Random Forest Forecast</h1>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Adjust crop and weather inputs below, then run the AI prediction to estimate yield per field and per hectare.
          </p>
        </div>
      </div>
      <FarmInputForm value={input} onChange={setInput} />
      <AiYieldPanel input={input} />
    </div>
  );
}

export const Route = createFileRoute("/estimator_/yield")({
  head: () => ({
    meta: [
      { title: "Estimator · Yield Prediction — AgriPulse" },
      { name: "description", content: "Predict crop yield from soil moisture, weather, and crop type using a random forest model." },
    ],
  }),
  component: YieldPredictionPage,
});
