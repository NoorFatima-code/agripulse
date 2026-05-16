import { supabase } from "./client";

// --- Types -------------------------------------------------------------------

export interface NotificationData {
  user_id: string;
  title: string;
  body: string;
  type: "success" | "error" | "info" | "warning" | "irrigation";
}

export interface ProfileData {
  display_name?: string;
  farm_name?: string;
  language?: string;
  ui_mode?: string;
  avatar_url?: string;
}

export interface FieldData {
  id?: string;
  user_id: string;
  name: string;
  crop: string;
  soil?: string;
  area_ha: number;
  flow_lpm: number;
  language?: string;
  last_watered_at?: string | null;
  created_at?: number; // kept for backwards compat sorting
}

export interface FarmReportData {
  user_id: string;
  kind: "voice" | "photo" | "manual";
  crop?: string;
  note?: string;
  ai_response?: string;
  image_url?: string;
  language?: string;
}

// --- Notifications -----------------------------------------------------------

export async function insertNotification(notification: NotificationData) {
  const { error } = await supabase.from("notifications").insert({
    user_id: notification.user_id,
    title: notification.title,
    body: notification.body,
    type: notification.type,
  });
  return { error: error ? { message: error.message } : null };
}

export async function getUserNotifications(userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  return { notifications: data, error: error ? { message: error.message } : null };
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id);
  return { error: error ? { message: error.message } : null };
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  return { error: error ? { message: error.message } : null };
}

export async function deleteNotification(id: string) {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  return { error: error ? { message: error.message } : null };
}

let notificationsChannel: any | null = null;
let notificationsUserId: string | null = null;
const notificationsCallbacks = new Set<(notifications: any) => void>();

function broadcastNotifications(notifications: any) {
  notificationsCallbacks.forEach((callback) => callback(notifications));
}

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: any) => void
) {
  const channelId = `notifications:${userId}`;

  if (notificationsUserId !== userId && notificationsChannel) {
    notificationsChannel.unsubscribe?.();
    (supabase as any).removeChannel?.(notificationsChannel).catch(() => undefined);
    notificationsChannel = null;
    notificationsCallbacks.clear();
  }

  notificationsUserId = userId;
  notificationsCallbacks.add(callback);

  if (!notificationsChannel) {
    const existingChannels = (supabase as any).getChannels?.() as Array<any> | undefined;
    if (existingChannels) {
      existingChannels
        .filter((c) => c?.id === channelId)
        .forEach((existing) => {
          existing.unsubscribe?.();
          (supabase as any).removeChannel?.(existing).catch(() => undefined);
        });
    }

    notificationsChannel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        async () => {
          const { notifications } = await getUserNotifications(userId);
          if (notifications) broadcastNotifications(notifications);
        }
      )
      .subscribe();
  }

  return () => {
    notificationsCallbacks.delete(callback);
    if (notificationsCallbacks.size === 0 && notificationsChannel) {
      notificationsChannel.unsubscribe?.();
      (supabase as any).removeChannel?.(notificationsChannel).catch(() => undefined);
      notificationsChannel = null;
      notificationsUserId = null;
    }
  };
}

// --- Profiles ----------------------------------------------------------------

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return { profile: data, error: error ? { message: error.message } : null };
}

export async function updateUserProfile(userId: string, profileData: ProfileData) {
  const { error } = await supabase
    .from("profiles")
    .update(profileData)
    .eq("id", userId);
  return { error: error ? { message: error.message } : null };
}

export async function createUserProfile(userId: string, profileData: ProfileData) {
  // Upsert -- the DB trigger auto-creates the profile on signup, but this
  // lets callers add extra fields (farm_name, etc.) after the fact.
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...profileData });
  return { error: error ? { message: error.message } : null };
}

// --- Farm Fields -------------------------------------------------------------

export async function getUserFields(userId: string) {
  const { data, error } = await supabase
    .from("farm_fields")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return { data, error: error ? { message: error.message } : null };
}

export async function upsertField(field: FieldData) {
  const { created_at: _, ...rest } = field; // strip non-schema keys
  const { error } = await supabase.from("farm_fields").upsert(rest);
  return { error: error ? { message: error.message } : null };
}

export async function updateField(fieldId: string, updates: Partial<FieldData>) {
  // Strip read-only / generated columns before sending to Supabase
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, user_id: _uid, ...rest } = updates;
  const { error } = await supabase
    .from("farm_fields")
    .update(rest as any)
    .eq("id", fieldId);
  return { error: error ? { message: error.message } : null };
}

export async function deleteField(fieldId: string) {
  const { error } = await supabase.from("farm_fields").delete().eq("id", fieldId);
  return { error: error ? { message: error.message } : null };
}

// --- Farm Reports ------------------------------------------------------------

export async function insertFarmReport(report: FarmReportData) {
  const { error } = await supabase.from("farm_reports").insert(report);
  return { error: error ? { message: error.message } : null };
}
