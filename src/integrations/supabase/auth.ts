import { supabase } from "./client";
import type { User } from "@supabase/supabase-js";

export { supabase };
export type { User };

export async function signUp(
  email: string,
  password: string,
  displayName?: string,
  additionalData?: Record<string, unknown>
) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || email.split("@")[0],
          ...additionalData,
        },
      },
    });
    if (error) return { user: null, error: { message: error.message, code: error.status?.toString() } };
    return { user: data.user, error: null };
  } catch (error: any) {
    return { user: null, error: { message: error.message, code: "unknown" } };
  }
}

export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { user: null, error: { message: error.message, code: error.status?.toString() } };
    return { user: data.user, error: null };
  } catch (error: any) {
    return { user: null, error: { message: error.message, code: "unknown" } };
  }
}

export async function signInWithGoogle() {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) return { user: null, error: { message: error.message, code: error.status?.toString() } };
    // OAuth flow redirects the page — user will be set via onAuthStateChange after redirect
    return { user: null, error: null };
  } catch (error: any) {
    return { user: null, error: { message: error.message, code: "unknown" } };
  }
}

export async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return { error: { message: error.message } };
    return { error: null };
  } catch (error: any) {
    return { error: { message: error.message } };
  }
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

export function getCurrentUser(): User | null {
  // Sync access not available in Supabase — use onAuthStateChange / AuthProvider instead
  return null;
}
