import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Droplets, Trash2, CheckCircle2, Loader2, Sprout, Bell, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  getUserFields,
  upsertField,
  deleteField,
  updateField,
  insertNotification,
} from "@/integrations/supabase/database";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { computeDailyAdvice } from "@/lib/irrigationAdvice";
import { AiSchedulePanel } from "@/components/AiPanels";
import { toApiCrop, type ApiField } from "@/lib/agripulseApi";

interface FieldRow {
  id: string;
  name: string;
  crop: string;
  soil: string | null;
  area_ha: number;
  flow_lpm: number;
  last_watered_at: string | null;
}

const CROP_OPTS = [
  { value: "wheat", en: "Wheat 🌾", ur: "گندم 🌾", hi: "गेहूँ 🌾" },
  { value: "maize", en: "Maize 🌽", ur: "مکئی 🌽", hi: "मक्का 🌽" },
  { value: "rice", en: "Rice 🌾", ur: "چاول 🌾", hi: "चावल 🌾" },
  { value: "tomato", en: "Tomato 🍅", ur: "ٹماٹر 🍅", hi: "टमाटर 🍅" },
  { value: "cotton", en: "Cotton ☁️", ur: "کپاس ☁️", hi: "कपास ☁️" },
  { value: "soybean", en: "Soybean 🫘", ur: "سویا 🫘", hi: "सोया 🫘" },
];
const SOIL_OPTS = [
  { value: "sandy", en: "Sandy 🏖️", ur: "ریتلی 🏖️", hi: "रेतीली 🏖️" },
  { value: "loamy", en: "Loamy 🌾", ur: "زرخیز 🌾", hi: "दोमट 🌾" },
  { value: "clay", en: "Clay 🪨", ur: "چکنی 🪨", hi: "चिकनी 🪨" },
  { value: "silty", en: "Silty 💧", ur: "گاد 💧", hi: "सिल्ट 💧" },
];

export function MyFields() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const tx = (en: string, ur: string, _pa?: string) => (lang === "ur" ? ur : en);

  const [fields, setFields] = useState<FieldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  // form
  const [name, setName] = useState("");
  const [crop, setCrop] = useState("maize");
  const [soil, setSoil] = useState("loamy");
  const [areaHa, setAreaHa] = useState("1");
  const [flowLpm, setFlowLpm] = useState("1500");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await getUserFields(user.id);
    if (error) toast.error(error.message);
    if (data) setFields(data as FieldRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const reset = () => {
    setName(""); setCrop("maize"); setSoil("loamy"); setAreaHa("1"); setFlowLpm("1500");
  };

  const addField = async () => {
    if (!user) return;
    if (!name.trim()) { toast.error(tx("Field name needed", "کھیت کا نام چاہیے", "खेत का नाम चाहिए")); return; }
    setSaving(true);
    const result = await upsertField({
      user_id: user.id,
      name: name.trim(),
      crop,
      soil,
      area_ha: Number(areaHa) || 1,
      flow_lpm: Number(flowLpm) || 1500,
      language: lang,
    });
    setSaving(false);
    if (result.error) { toast.error(result.error.message); return; }
    toast.success(tx("Field saved", "کھیت محفوظ ہو گیا", "खेत सहेजा गया"));
    reset(); setOpen(false); load();
  };

  const removeField = async (id: string) => {
    const { error } = await deleteField(id);
    if (error) toast.error(error.message);
    else setFields((f) => f.filter((x) => x.id !== id));
  };

  const checkToday = async (field: FieldRow) => {
    if (!user) return;
    setCheckingId(field.id);
    try {
      const advice = computeDailyAdvice(field, lang);
      const result = await insertNotification({
        user_id: user.id,
        title: advice.title,
        body: advice.body,
        type: advice.type,
      });
      if (result.error) throw new Error(result.error.message);
      toast.success(advice.title);
      if (advice.shouldWater) {
        await updateField(field.id, { last_watered_at: new Date().toISOString() });
      }
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setCheckingId(null);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="mb-4 text-muted-foreground">
          {tx("Please sign in to save your fields.", "اپنے کھیت محفوظ کرنے کے لیے داخل ہوں۔", "अपने खेत सहेजने के लिए साइन इन करें।")}
        </p>
        <Button asChild><Link to="/auth">{tx("Sign in", "داخل ہوں", "साइन इन")}</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-primary/5 via-background to-background pb-16">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md md:px-6">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="font-display text-lg font-semibold">
              {tx("My Fields", "میرے کھیت", "मेरे खेत")}
            </p>
            <p className="text-xs text-muted-foreground">
              {tx("Save once. Tap to know if you need to water today.", "ایک بار محفوظ کریں۔ روز چیک کریں کہ پانی دینا ہے یا نہیں۔", "एक बार सहेजें। रोज़ देखें कि पानी देना है या नहीं।")}
            </p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 bg-gradient-leaf text-white">
              <Plus className="h-4 w-4" /> {tx("Add field", "کھیت شامل کریں", "खेत जोड़ें")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tx("Add a field", "کھیت شامل کریں", "खेत जोड़ें")}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>{tx("Name", "نام", "नाम")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={tx("e.g. North field", "مثلاً شمالی کھیت", "जैसे उत्तरी खेत")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{tx("Crop", "فصل", "फसल")}</Label>
                  <Select value={crop} onValueChange={setCrop}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CROP_OPTS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{tx(o.en, o.ur, o.hi)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{tx("Soil", "مٹی", "मिट्टी")}</Label>
                  <Select value={soil} onValueChange={setSoil}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SOIL_OPTS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{tx(o.en, o.ur, o.hi)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{tx("Area (hectares)", "رقبہ (ہیکٹر)", "क्षेत्र (हेक्टेयर)")}</Label>
                  <Input type="number" step="0.1" min="0.1" value={areaHa} onChange={(e) => setAreaHa(e.target.value)} />
                </div>
                <div>
                  <Label>{tx("Pump flow (L/min)", "پمپ بہاؤ (لیٹر/منٹ)", "पंप प्रवाह (लीटर/मिनट)")}</Label>
                  <Input type="number" min="50" value={flowLpm} onChange={(e) => setFlowLpm(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={addField} disabled={saving} className="gap-1 bg-gradient-leaf text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {tx("Save field", "محفوظ کریں", "सहेजें")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mx-auto max-w-3xl space-y-3 p-4 md:p-6">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : fields.length === 0 ? (
          <Card className="p-10 text-center">
            <Sprout className="mx-auto mb-3 h-10 w-10 text-primary" />
            <p className="font-medium">
              {tx("No fields yet", "ابھی کوئی کھیت نہیں", "अभी कोई खेत नहीं")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tx("Add your first field to get daily watering advice.", "روزانہ پانی کا مشورہ پانے کے لیے پہلا کھیت شامل کریں۔", "रोज़ाना सलाह पाने के लिए पहला खेत जोड़ें।")}
            </p>
          </Card>
        ) : (
          fields.map((f) => {
            const cropLabel = CROP_OPTS.find((c) => c.value === f.crop);
            const soilLabel = SOIL_OPTS.find((s) => s.value === f.soil);
            return (
              <Card key={f.id} className="overflow-hidden">
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-semibold">{f.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {cropLabel ? tx(cropLabel.en, cropLabel.ur, cropLabel.hi) : f.crop}
                      {" · "}
                      {soilLabel ? tx(soilLabel.en, soilLabel.ur, soilLabel.hi) : f.soil}
                      {" · "}
                      {f.area_ha} {tx("ha", "ہیکٹر", "हे")}
                    </p>
                    {f.last_watered_at && (
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary">
                        <CheckCircle2 className="h-3 w-3" />
                        {tx("Last watered", "آخری بار پانی", "अंतिम पानी")}: {new Date(f.last_watered_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeField(f.id)} aria-label="Delete">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                <div className="flex border-t">
                  <Button
                    onClick={() => checkToday(f)}
                    disabled={checkingId === f.id}
                    variant="ghost"
                    className="flex-1 gap-2 rounded-none py-5 text-sm font-medium"
                  >
                    {checkingId === f.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Droplets className="h-4 w-4 text-water" />
                    )}
                    {tx("Check today's watering", "آج کا پانی چیک کریں", "आज का पानी देखें")}
                  </Button>
                  <Link
                    to="/notifications"
                    className="flex items-center gap-1 border-l px-4 text-xs text-muted-foreground hover:bg-muted"
                  >
                    <Bell className="h-3.5 w-3.5" /> {tx("Alerts", "اطلاعات", "सूचनाएँ")}
                  </Link>
                </div>
              </Card>
            );
          })
        )}

        
      </div>
    </div>
  );
}
