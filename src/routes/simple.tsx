import { createFileRoute } from "@tanstack/react-router";
import { SimpleMode } from "@/components/SimpleMode";

export const Route = createFileRoute("/simple")({
  head: () => ({
    meta: [
      { title: "Simple Mode — AgriPulse" },
      { name: "description", content: "Voice-first farm advisor for farmers — talk, snap a photo, get clear advice." },
    ],
  }),
  component: SimpleMode,
});
