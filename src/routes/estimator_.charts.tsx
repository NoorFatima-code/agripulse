import { createFileRoute } from "@tanstack/react-router";
import { YieldPredictionPage } from "@/components/YieldPredictionPage";

export const Route = createFileRoute("/estimator_/charts")({
  head: () => ({
    meta: [{ title: "Yield Prediction — AgriPulse" }],
  }),
  component: YieldPredictionPage,
});
