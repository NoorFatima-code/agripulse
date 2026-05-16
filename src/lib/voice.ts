export type VoiceLang = "en" | "ur";

const LANG_TAG: Record<VoiceLang, string> = {
  en: "en-US",
  ur: "ur-PK",
};

// ─── Text-to-speech ───────────────────────────────────────────────────────────

export function speak(text: string, lang: VoiceLang = "en") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = LANG_TAG[lang];
    utter.rate = 0.95;
    utter.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) =>
      v.lang.toLowerCase().startsWith(LANG_TAG[lang].toLowerCase())
    );
    if (match) utter.voice = match;
    window.speechSynthesis.speak(utter);
  } catch (e) {
    console.warn("speak failed", e);
  }
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

export function isVoiceSupported() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

// ─── Groq Whisper recorder ────────────────────────────────────────────────────
// Press to start recording, press again to stop => Groq transcribes via Groq.
// No dependency on Google speech servers -- works anywhere.

export interface WhisperRecorder {
  stop: () => void;
  abort: () => void;
}

interface WhisperOptions {
  lang: VoiceLang;
  apiKey: string;
  onTranscript: (text: string) => void;
  onError: (msg: string) => void;
  onVolumeChange?: (vol: number) => void; // 0-1, for mic animation
}

/** Pick the best MIME type supported by this browser/OS.
 *  iOS Safari: audio/mp4  |  Android/Chrome/Firefox: audio/webm  */
function getBestMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",       // iOS Safari 14.5+
    "audio/ogg",
  ];
  for (const t of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch { /* isTypeSupported can throw in some envs */ }
  }
  return ""; // let the browser choose
}

/** Map MIME type to a file extension Groq will accept. */
function mimeToExt(mimeType: string): string {
  if (mimeType.includes("mp4"))  return "mp4";
  if (mimeType.includes("ogg"))  return "ogg";
  return "webm"; // default
}

export async function startWhisperRecording(
  opts: WhisperOptions
): Promise<WhisperRecorder | null> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    const e = err as Error;
    if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
      opts.onError("Microphone permission denied. Please allow mic access.");
    } else {
      opts.onError("Could not access microphone. " + (e?.message ?? ""));
    }
    return null;
  }

  const chunks: Blob[] = [];
  let aborted = false;

  // Volume meter via AnalyserNode
  let animFrameId: number | null = null;
  if (opts.onVolumeChange) {
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        opts.onVolumeChange!(Math.min(avg / 128, 1));
        animFrameId = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* volume meter is non-critical */ }
  }

  const mimeType = getBestMimeType();
  const fileExt  = mimeToExt(mimeType);

  let recorder: MediaRecorder;
  try {
    recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    opts.onError("Recording not supported in this browser. Please type instead.");
    return null;
  }

  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  recorder.onstop = async () => {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    stream.getTracks().forEach((t) => t.stop());
    opts.onVolumeChange?.(0);

    if (aborted || chunks.length === 0) return;

    const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
    if (blob.size < 1000) {
      opts.onError("No speech detected. Please try again.");
      return;
    }

    try {
      const form = new FormData();
      form.append("file", blob, `audio.${fileExt}`);
      form.append("model", "whisper-large-v3-turbo");
      form.append("language", opts.lang === "ur" ? "ur" : "en");
      form.append("response_format", "json");

      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.apiKey}` },
        body: form,
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 401) {
          opts.onError("API key invalid. Check VITE_GEMINI_API_KEY in .env");
          return;
        }
        if (res.status === 429) {
          opts.onError("Too many requests. Please wait a moment and try again.");
          return;
        }
        throw new Error(`Whisper error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const text = (data.text || "").trim();
      if (!text) {
        opts.onError("Could not understand. Please try again.");
        return;
      }
      opts.onTranscript(text);
    } catch (e) {
      opts.onError(e instanceof Error ? e.message : "Transcription failed");
    }
  };

  recorder.start(250); // collect chunks every 250 ms

  return {
    stop:  () => { if (recorder.state !== "inactive") recorder.stop(); },
    abort: () => { aborted = true; if (recorder.state !== "inactive") recorder.stop(); },
  };
}
