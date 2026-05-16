import { createFileRoute } from "@tanstack/react-router";
import { MyFields } from "@/components/MyFields";

export const Route = createFileRoute("/fields")({
  head: () => ({
    meta: [
      { title: "My Fields — AgriPulse" },
      { name: "description", content: "Save your fields and get layman daily watering advice in your language." },
    ],
  }),
  component: MyFields,
});
