import { createFileRoute } from "@tanstack/react-router";
import { WaterAllocationPage } from "@/components/WaterAllocationPage";

export const Route = createFileRoute("/estimator_/water-allocation")({
  head: () => ({
    meta: [
      { title: "Estimator · Water Allocation — AgriPulse" },
      { name: "description", content: "Optimize field irrigation using knapsack-based water allocation and yield prediction." },
    ],
  }),
  component: () => <WaterAllocationPage />,
});
