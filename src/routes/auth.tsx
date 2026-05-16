import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Leaf, Mail, Lock, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { signUp, signIn, signInWithGoogle } from "@/integrations/supabase/auth";
import { updateUserProfile } from "@/integrations/supabase/database";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — AgriPulse" },
      { name: "description", content: "Sign in or create your AgriPulse account to save fields and receive alerts." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { user: newUser, error } = await signUp(
          email,
          password,
          displayName || email.split("@")[0]
        );
        if (error) throw new Error(error.message);

        // The DB trigger auto-creates the profile row on signup.
        // We only need to patch extra fields (farm_name) if provided.
        if (newUser && farmName) {
          await updateUserProfile(newUser.id, { farm_name: farmName });
        }
        toast.success(t("toast.signedIn"));
      } else {
        const { error } = await signIn(email, password);
        if (error) throw new Error(error.message);
        toast.success(t("toast.signedIn"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      // Supabase Google OAuth is a redirect flow — the page will navigate away.
      // setBusy stays true intentionally so the button shows a spinner during redirect.
      const { error } = await signInWithGoogle();
      if (error) {
        toast.error(error.message || "Google sign-in failed");
        setBusy(false);
      }
      // On success: browser redirects — no further action needed here.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-leaf text-white shadow-glow">
              <Leaf className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-sm font-semibold">{t("app.name")}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.tagline")}</p>
            </div>
          </Link>
          <LanguageSwitcher />
        </div>

        <Card className="border-primary/20 shadow-soft">
          <CardContent className="p-6">
            <h1 className="font-display text-2xl font-semibold">
              {mode === "signin" ? t("auth.signin.title") : t("auth.signup.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin" ? t("auth.signin.subtitle") : t("auth.signup.subtitle")}
            </p>

            <Button
              type="button"
              variant="outline"
              className="mt-6 w-full gap-2"
              onClick={handleGoogle}
              disabled={busy}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.45.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84Z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.16-3.16C17.45 2.16 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
              </svg>
              {t("auth.google")}
            </Button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("auth.or")}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleEmail} className="space-y-3">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">{t("auth.displayName")}</Label>
                  <div className="relative">
                    <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="pl-9" required />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" required minLength={6} />
                </div>
              </div>
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="farm">{t("auth.farmName")}</Label>
                  <Input id="farm" value={farmName} onChange={(e) => setFarmName(e.target.value)} />
                </div>
              )}

              <Button type="submit" className="w-full bg-gradient-leaf text-white shadow-glow hover:opacity-95" disabled={busy}>
                {busy ? t("common.loading") : mode === "signin" ? t("auth.signin.button") : t("auth.signup.button")}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="mt-4 block w-full text-center text-xs text-muted-foreground hover:text-primary"
            >
              {mode === "signin" ? t("auth.toggle.signup") : t("auth.toggle.signin")}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
