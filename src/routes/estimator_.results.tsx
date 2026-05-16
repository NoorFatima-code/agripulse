import { createFileRoute } from "@tanstack/react-router";
import { IrrigationSchedulePage } from "@/components/IrrigationSchedulePage";

export const Route = createFileRoute("/estimator_/results")({
  head: () => ({
    meta: [{ title: "Irrigation Schedule — AgriPulse" }],
  }),
  component: IrrigationSchedulePage,
});
