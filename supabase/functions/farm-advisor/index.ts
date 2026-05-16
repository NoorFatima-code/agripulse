// Farm advisor — uses Google Gemini 1.5 Flash (free tier via Google AI Studio)
// Deploy: supabase functions deploy farm-advisor
// Secret:  supabase secrets set GEMINI_API_KEY=your_key

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LANG_NAME: Record<string, string> = {
  en: "English",
  ur: "Urdu",
  hi: "Hindi",
  pa: "Punjabi",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, imageUrl, language = "en", history = [] } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const langName = LANG_NAME[language] ?? "English";

    const systemInstruction = `You are AgriPulse, a friendly farm advisor for small farmers.
Speak in very simple ${langName}. Use short sentences (max 2-3 lines).
Avoid jargon. Use everyday words.
Give concrete advice: amount of water, when to spray, what to look for.
If a photo is shared, describe what you see and suggest one clear next step.
Always reply in ${langName}.`;

    // Build conversation parts
    const contents: object[] = [];

    // Add history
    for (const turn of history.slice(-8)) {
      contents.push({
        role: turn.role === "assistant" ? "model" : "user",
        parts: [{ text: turn.content }],
      });
    }

    // Build current user message parts
    const userParts: object[] = [];
    if (message) userParts.push({ text: message });
    if (imageUrl) {
      // Fetch image and convert to base64 for Gemini
      try {
        const imgRes = await fetch(imageUrl);
        const imgBuf = await imgRes.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(imgBuf)));
        const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
        userParts.push({ inline_data: { mime_type: mimeType, data: b64 } });
      } catch {
        userParts.push({ text: "[image could not be loaded]" });
      }
    }
    if (userParts.length === 0) userParts.push({ text: "Hello" });

    contents.push({ role: "user", parts: userParts });

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
        }),
      }
    );

    if (geminiRes.status === 429) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment and try again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!geminiRes.ok) {
      const t = await geminiRes.text();
      console.error("Gemini error", geminiRes.status, t);
      throw new Error(`Gemini API error: ${geminiRes.status}`);
    }

    const data = await geminiRes.json();
    const reply: string =
      data.candidates?.[0]?.content?.parts?.[0]?.text ??
      "Sorry, I could not get a response. Please try again.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("farm-advisor error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
