import { useEffect, useState } from "react";
import { Bell, Check, Trash2, Droplets, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  getUserNotifications,
  subscribeToNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
  insertNotification,
} from "@/integrations/supabase/database";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  type: string;
  read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  irrigation: Droplets,
};

const TYPE_COLORS: Record<string, string> = {
  info: "text-water",
  warning: "text-soil",
  success: "text-primary",
  irrigation: "text-water",
};

export function NotificationsBell() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);

  const unread = items.filter((i) => !i.read).length;

  const load = async () => {
    if (!user) return;
    const { notifications } = await getUserNotifications(user.id);
    if (notifications) setItems(notifications as NotificationRow[]);
  };

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    load();

    // Real-time subscription via Supabase Realtime (postgres_changes)
    const unsubscribe = subscribeToNotifications(user.id, (notifications) => {
      if (notifications) setItems(notifications as NotificationRow[]);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const markAllRead = async () => {
    if (!user) return;
    const { error } = await markAllNotificationsRead(user.id);
    if (error) toast.error(error.message);
    else setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const remove = async (id: string) => {
    const { error } = await deleteNotification(id);
    if (error) toast.error(error.message);
    else setItems((prev) => prev.filter((n) => n.id !== id));
  };

  const markRead = async (id: string) => {
    const { error } = await markNotificationRead(id);
    if (!error) setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const sendTest = async () => {
    if (!user) return;
    const samples = [
      { title: "Irrigation alert", body: "Your maize field needs ~12 mm of water today.", type: "irrigation" as const },
      { title: "Low rainfall warning", body: "No rain expected in the next 3 days.", type: "warning" as const },
      { title: "Yield improving", body: "Conditions look great -- yield trend +5%.", type: "success" as const },
    ];
    const pick = samples[Math.floor(Math.random() * samples.length)];
    const result = await insertNotification({ user_id: user.id, ...pick });
    if (result.error) toast.error(result.error.message);
    else { toast.success(t("toast.notifSent")); load(); }
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full bg-destructive p-0 px-1 text-[10px] text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">{t("notifications.title")}</p>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={sendTest} className="h-7 text-xs">
              + Test
            </Button>
            {unread > 0 && (
              <Button size="sm" variant="ghost" onClick={markAllRead} className="h-7 gap-1 text-xs">
                <Check className="h-3 w-3" /> {t("notifications.markRead")}
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t("notifications.empty")}
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Info;
                const color = TYPE_COLORS[n.type] ?? "text-foreground";
                return (
                  <li
                    key={n.id}
                    className={cn("group px-4 py-3", !n.read && "bg-primary/5")}
                    onClick={() => !n.read && markRead(n.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", color)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight">{n.title}</p>
                        {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 transition group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                        aria-label={t("notifications.delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
