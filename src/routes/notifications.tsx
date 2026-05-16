import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Trash2, Droplets, Info, AlertTriangle, CheckCircle2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getUserNotifications,
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "@/integrations/supabase/database";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [{ title: "Notifications -- AgriPulse" }],
  }),
  component: NotificationsPage,
});

interface Row {
  id: string;
  title: string;
  body: string | null;
  type: string;
  read: boolean;
  created_at: string;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  irrigation: Droplets,
};

function NotificationsPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<Row[]>([]);

  const load = async () => {
    if (!user) return;
    const { notifications } = await getUserNotifications(user.id);
    if (notifications) setItems(notifications as Row[]);
  };

  useEffect(() => {
    if (!user) { setItems([]); return; }
    load();

    const unsubscribe = subscribeToNotifications(user.id, (notifications) => {
      if (notifications) setItems(notifications as Row[]);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const remove = async (id: string) => {
    const { error } = await deleteNotification(id);
    if (error) toast.error(error.message);
    else setItems((s) => s.filter((i) => i.id !== id));
  };

  const markRead = async (id: string) => {
    const { error } = await markNotificationRead(id);
    if (!error) setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    const { error } = await markAllNotificationsRead(user.id);
    if (error) { toast.error(error.message); return; }
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success(t("notifications.markRead"));
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">{t("common.loading")}</div>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="mb-4 text-sm text-muted-foreground">{t("nav.signin")} to view your notifications.</p>
        <Button asChild><Link to="/auth">{t("nav.signin")}</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t("notifications.title")}</h1>
          <p className="text-sm text-muted-foreground">{items.length} total</p>
        </div>
        {items.some((i) => !i.read) && (
          <Button onClick={markAllRead} variant="outline" size="sm" className="gap-1.5">
            <Check className="h-4 w-4" /> {t("notifications.markRead")}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{t("notifications.empty")}</CardContent></Card>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const Icon = ICONS[n.type] ?? Info;
            return (
              <li key={n.id} onClick={() => !n.read && markRead(n.id)} className="cursor-pointer">
                <Card className={cn(!n.read && "border-primary/40 bg-primary/5")}>
                  <CardContent className="flex items-start gap-3 p-4">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{n.title}</p>
                      {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                      aria-label={t("notifications.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
