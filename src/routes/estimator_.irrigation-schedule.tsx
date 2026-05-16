import { createFileRoute } from "@tanstack/react-router";
import { IrrigationSchedulePage } from "@/components/IrrigationSchedulePage";

export const Route = createFileRoute("/estimator_/irrigation-schedule")({
  head: () => ({
    meta: [
      { title: "Estimator · Irrigation Schedule — AgriPulse" },
      { name: "description", content: "Generate a priority irrigation schedule with a greedy algorithm for water-limited farms." },
    ],
  }),
  component: () => <IrrigationSchedulePage />,
});
