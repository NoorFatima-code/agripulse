import { createFileRoute } from "@tanstack/react-router";
import { SimpleManual } from "@/components/SimpleManual";

export const Route = createFileRoute("/simple/manual")({
  head: () => ({
    meta: [
      { title: "Quick farm details — AgriPulse" },
      { name: "description", content: "Pick crop, soil, water and weather with simple icons to get clear advice." },
    ],
  }),
  component: SimpleManual,
});
