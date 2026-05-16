import { useEffect, useRef, useState } from "react";
import {
  Mic, MicOff, Camera, Volume2, VolumeX, Loader2,
  Wheat, Droplets, Bug, Sun, Send, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { speak, stopSpeaking, isVoiceSupported, startWhisperRecording, type WhisperRecorder, type VoiceLang } from "@/lib/voice";
import { callFarmAdvisor, logFarmReport } from "@/lib/farmAdvisor";
import { supabase } from "@/integrations/supabase/client";

interface Turn {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

const QUICK_PROMPTS: { key: string; en: string; ur: string; icon: typeof Wheat }[] = [
  { key: "water", en: "Should I water my crop today?", ur: "کیا آج فصل کو پانی دینا چاہیے؟", icon: Droplets },
  { key: "pest", en: "My leaves have spots, what to do?", ur: "میرے پتوں پر دھبے ہیں، کیا کروں؟", icon: Bug },
  { key: "weather", en: "How will weather affect my crop this week?", ur: "اس ہفتے موسم میری فصل پر کیا اثر ڈالے گا؟", icon: Sun },
  { key: "yield", en: "How can I improve my crop yield?", ur: "میں اپنی پیداوار کیسے بڑھاؤں؟", icon: Wheat },
];

export function SimpleMode() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const voiceLang = (["en", "ur"].includes(lang) ? lang : "en") as VoiceLang;

  const [turns, setTurns] = useState<Turn[]>([]);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [pendingImage, setPendingImage] = useState<{ url: string; file: string } | null>(null);
  const [micVolume, setMicVolume] = useState(0);

  const recorderRef = useRef<WhisperRecorder | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, thinking]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      recorderRef.current?.abort();
    };
  }, []);

  const tx = (en: string, ur: string) => lang === "ur" ? ur : en;

  const buildHistory = (currentTurns: Turn[]) =>
    currentTurns.map((t) => ({ role: t.role, content: t.content }));

  const sendToAdvisor = async (message: string, imageUrl?: string) => {
    if (!message.trim() && !imageUrl) return;
    setThinking(true);
    setPendingImage(null);

    const userContent = message.trim() || tx("What is this?", "یہ کیا ہے؟");
    const newTurn: Turn = { role: "user", content: userContent, imageUrl };
    const nextTurns = [...turns, newTurn];
    setTurns(nextTurns);

    try {
      const { data, error } = await callFarmAdvisor({
        message: userContent,
        language: lang,
        imageUrl,
        history: buildHistory(turns),
      });
      if (error) throw error;

      const reply = data?.reply ?? "...";
      setTurns([...nextTurns, { role: "assistant", content: reply }]);
      setSpeaking(true);
      speak(reply, voiceLang);
      setTimeout(() => setSpeaking(false), Math.max(2000, reply.length * 60));

      if (user) {
        await logFarmReport({
          user_id: user.id,
          kind: imageUrl ? "photo" : "voice",
          crop: "unknown",
          note: message,
          ai_response: reply,
          language: lang,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setTurns(turns);
    } finally {
      setThinking(false);
    }
  };

  const handleSendText = () => {
    const msg = textInput.trim();
    const imgUrl = pendingImage?.url;
    if (!msg && !imgUrl) return;
    setTextInput("");
    sendToAdvisor(msg, imgUrl);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleMic = async () => {
    stopSpeaking();
    setSpeaking(false);

    if (listening) {
      recorderRef.current?.stop();
      setListening(false);
      setTranscribing(true);
      return;
    }

    if (!isVoiceSupported()) {
      toast.error(tx("Mic not supported in this browser", "یہ براؤزر مائیک سپورٹ نہیں کرتا"));
      return;
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) { toast.error("API key missing"); return; }

    const recorder = await startWhisperRecording({
      lang: voiceLang,
      apiKey,
      onVolumeChange: (vol) => setMicVolume(vol),
      onTranscript: (text) => {
        setTranscribing(false);
        setMicVolume(0);
        sendToAdvisor(text);
      },
      onError: (msg) => {
        setTranscribing(false);
        setListening(false);
        setMicVolume(0);
        toast.error(msg);
        setTimeout(() => textRef.current?.focus(), 100);
      },
    });

    if (recorder) {
      recorderRef.current = recorder;
      setListening(true);
    }
  };

  const handlePhoto = async (file: File) => {
    if (!user) {
      toast.error(tx("Please sign in to upload photos", "تصویر بھیجنے کے لیے سائن ان کریں"));
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("crop-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from("crop-photos").getPublicUrl(path);
      setPendingImage({ url: urlData.publicUrl, file: file.name });
      textRef.current?.focus();
      toast.success(tx("Photo ready — add a message or send", "تصویر تیار ہے — پیغام لکھیں یا بھیجیں"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clearChat = () => {
    stopSpeaking();
    setSpeaking(false);
    recorderRef.current?.abort();
    setListening(false);
    setTranscribing(false);
    setTurns([]);
    setPendingImage(null);
    setTextInput("");
    setMicVolume(0);
  };

  const micScale = 1 + micVolume * 0.4;

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-primary/5 via-background to-background">

      {/* ── Conversation ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-3">

          {/* Clear button — top right of chat area */}
          {turns.length > 0 && (
            <div className="flex justify-end">
              <Button onClick={clearChat} variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                <Trash2 className="h-3.5 w-3.5" />
                {tx("Clear chat", "گفتگو صاف کریں")}
              </Button>
            </div>
          )}

          {turns.length === 0 && (
            <div className="rounded-3xl bg-card/60 p-6 text-center shadow-soft">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mic className="h-8 w-8" />
              </div>
              <p className="font-display text-lg font-semibold">
                {tx("Ask anything about your farm", "اپنی فصل کے بارے میں کچھ بھی پوچھیں")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {tx("Hold mic to record · Camera · Type", "مائیک دبائیں · تصویر · لکھیں")}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2 text-left">
                {QUICK_PROMPTS.map((q) => {
                  const text = q[lang as "en" | "ur"] ?? q.en;
                  return (
                    <button
                      key={q.key}
                      onClick={() => sendToAdvisor(text)}
                      disabled={thinking}
                      className="flex items-center gap-2 rounded-2xl border border-border bg-background p-3 text-left shadow-soft transition-all hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <q.icon className="h-4 w-4" />
                      </div>
                      <span className="text-[12px] font-medium leading-snug">{text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {turns.map((tn, i) => (
            <div key={i} className={`flex ${tn.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-soft ${
                tn.role === "user" ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
              }`}>
                {tn.imageUrl && (
                  <img src={tn.imageUrl} alt="crop" className="mb-2 max-h-52 w-full rounded-xl object-cover" />
                )}
                <p className="whitespace-pre-wrap">{tn.content}</p>
                {tn.role === "assistant" && (
                  <button
                    onClick={() => {
                      setSpeaking(true);
                      speak(tn.content, voiceLang);
                      setTimeout(() => setSpeaking(false), Math.max(2000, tn.content.length * 60));
                    }}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Volume2 className="h-3 w-3" />
                    {tx("Listen", "سنیں")}
                  </button>
                )}
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground shadow-soft">
                <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
                {tx("Thinking...", "سوچ رہا ہوں...")}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Input bar ── */}
      <div className="border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto max-w-2xl space-y-2">

          {pendingImage && (
            <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
              <Camera className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1 truncate text-xs text-primary">{pendingImage.file}</span>
              <button onClick={() => setPendingImage(null)} className="text-xs text-muted-foreground hover:text-destructive">✕</button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading || thinking || listening}
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            </Button>

            <textarea
              ref={textRef}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={thinking || listening || transcribing}
              placeholder={
                listening ? tx("Recording... tap mic again to stop", "ریکارڈ ہو رہا ہے... روکنے کے لیے مائیک دبائیں")
                : transcribing ? tx("Transcribing...", "تحریر ہو رہا ہے...")
                : tx("Type your question...", "سوال لکھیں...")
              }
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-[15px] leading-relaxed outline-none focus:border-primary/60 disabled:opacity-50"
              style={{ maxHeight: "120px", overflowY: "auto" }}
            />

            <div className="relative shrink-0">
              {listening && (
                <span
                  className="absolute inset-0 rounded-full bg-destructive/30 transition-transform duration-100"
                  style={{ transform: `scale(${micScale})` }}
                />
              )}
              <Button
                onClick={handleMic}
                disabled={thinking || transcribing}
                size="icon"
                className={`relative h-11 w-11 rounded-full ${
                  listening
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : "bg-gradient-leaf text-white hover:opacity-95"
                }`}
              >
                {transcribing ? <Loader2 className="h-5 w-5 animate-spin" />
                  : listening ? <MicOff className="h-5 w-5" />
                  : <Mic className="h-5 w-5" />}
              </Button>
            </div>

            {speaking ? (
              <Button
                onClick={() => { stopSpeaking(); setSpeaking(false); }}
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-full"
              >
                <VolumeX className="h-5 w-5" />
              </Button>
            ) : (
              <Button
                onClick={handleSendText}
                disabled={thinking || listening || transcribing || (!textInput.trim() && !pendingImage)}
                size="icon"
                className="h-11 w-11 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send className="h-5 w-5" />
              </Button>
            )}
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            {listening ? tx("🔴 Recording — tap mic to stop & send", "🔴 ریکارڈ ہو رہا ہے — روکنے کے لیے مائیک دبائیں")
              : transcribing ? tx("⏳ Converting speech to text...", "⏳ آواز کو تحریر میں بدل رہا ہے...")
              : tx("Tap mic to speak · Camera · Type", "مائیک دبائیں · تصویر · لکھیں")}
          </p>
        </div>
      </div>
    </div>
  );
}