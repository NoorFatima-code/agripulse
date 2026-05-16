import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Irrigation & Crop Yield Estimator" },
      {
        name: "description",
        content:
          "Estimate precise irrigation needs and predicted crop yields with a clean, data-driven smart-agriculture demo.",
      },
      { property: "og:title", content: "Smart Irrigation & Crop Yield Estimator" },
      {
        property: "og:description",
        content: "Visualize water savings and yield forecasts powered by simple agronomic models.",
      },
    ],
  }),
  component: () => <Dashboard view="home" showHero />,
});
