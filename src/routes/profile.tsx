import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { getUserProfile, updateUserProfile } from "@/integrations/supabase/database";
import { useAuth } from "@/lib/auth";
import { useI18n, LANGUAGES, type Language } from "@/lib/i18n";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — AgriPulse" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [displayName, setDisplayName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.id).then(({ profile }) => {
      if (profile) {
        setDisplayName(profile.display_name ?? "");
        setFarmName(profile.farm_name ?? "");
        if (
          profile.language &&
          profile.language !== lang &&
          (profile.language === "en" || profile.language === "ur")
        ) {
          setLang(profile.language as Language);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const result = await updateUserProfile(user.id, {
      display_name: displayName,
      farm_name: farmName,
      language: lang,
    });
    setBusy(false);
    if (result.error) toast.error(result.error.message);
    else toast.success(t("toast.profileUpdated"));
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">{t("common.loading")}</div>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <UserIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="mb-4 text-sm text-muted-foreground">{t("nav.signin")} to view your profile.</p>
        <Button asChild><Link to="/auth">{t("nav.signin")}</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-semibold">{t("profile.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>

      <Card className="mt-6">
        <CardContent className="p-6">
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dn">{t("auth.displayName")}</Label>
              <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fn">{t("auth.farmName")}</Label>
              <Input id="fn" value={farmName} onChange={(e) => setFarmName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("language.label")}</Label>
              <Select value={lang} onValueChange={(v) => setLang(v as Language)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>{l.native} — {l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="bg-gradient-leaf text-white shadow-glow hover:opacity-95" disabled={busy}>
              {busy ? t("common.loading") : t("profile.update")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
