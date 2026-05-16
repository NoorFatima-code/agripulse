import { insertFarmReport } from "@/integrations/supabase/database";

export interface FarmAdvisorRequest {
  message: string;
  language: string;
  imageUrl?: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

export interface FarmAdvisorResponse {
  reply: string;
}

const LANG_NAME: Record<string, string> = {
  en: "English",
  ur: "Urdu",
  hi: "Hindi",
};

/**
 * Call Groq API directly from the browser.
 * Uses llama-3.1-8b-instant for text, meta-llama/llama-4-scout-17b-16e-instruct for vision.
 * API key stored in VITE_GEMINI_API_KEY in .env
 */
export async function callFarmAdvisor(
  req: FarmAdvisorRequest
): Promise<{ data?: FarmAdvisorResponse; error?: Error }> {
  try {
    const GROQ_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

    if (!GROQ_API_KEY || GROQ_API_KEY === "your_gemini_api_key_here") {
      return {
        data: {
          reply:
            "Farm advisor is not configured yet. Please add your VITE_GEMINI_API_KEY to the .env file.",
        },
      };
    }

    const langName = LANG_NAME[req.language] ?? "English";

    const systemInstruction = `You are AgriPulse, a friendly farm advisor for small farmers.
Speak in very simple ${langName}. Use short sentences (max 2-3 lines).
Avoid jargon. Use everyday words.
Give concrete advice: amount of water, when to spray, what to look for.
Always reply in ${langName}.`;

    // Use vision model when image is provided
    const hasImage = !!req.imageUrl;
    const model = hasImage ? "meta-llama/llama-4-scout-17b-16e-instruct" : "llama-3.1-8b-instant";

    // Build the current user message content
    let userContent: string | object[];
    if (hasImage) {
      userContent = [
        {
          type: "image_url",
          image_url: { url: req.imageUrl },
        },
        {
          type: "text",
          text: req.message ||
            `Look at this crop photo carefully. What problem or condition do you see? Give one clear next step for the farmer. Reply in ${langName}.`,
        },
      ];
    } else {
      userContent = req.message || "Hello";
    }

    const messages: object[] = [
      { role: "system", content: systemInstruction },
      ...(req.history ?? []).slice(-8).map((t) => ({
        role: t.role === "assistant" ? "assistant" : "user",
        content: t.content,
      })),
      { role: "user", content: userContent },
    ];

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const reply: string =
      data.choices?.[0]?.message?.content ??
      "Sorry, I could not get a response. Please try again.";

    return { data: { reply } };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error("Unknown error") };
  }
}

/**
 * Persist a farm report to Supabase (farm_reports table).
 */
export async function logFarmReport(data: {
  user_id: string;
  kind: "voice" | "photo" | "manual";
  crop?: string;
  note?: string;
  ai_response?: string;
  image_url?: string;
  language?: string;
}): Promise<{ error?: Error }> {
  const { error } = await insertFarmReport(data);
  if (error) return { error: new Error(error.message) };
  return {};
}
