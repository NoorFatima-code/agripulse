import { createFileRoute } from "@tanstack/react-router";
import { WaterAllocationPage } from "@/components/WaterAllocationPage";

export const Route = createFileRoute("/estimator")({
  head: () => ({
    meta: [{ title: "Water Allocation — AgriPulse" }],
  }),
  component: WaterAllocationPage,
});
