import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { createUserProfile } from "../supabase/database";

const lovableAuth = createLovableAuth();

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "microsoft" | "lovable",
      opts?: SignInOptions
    ) => {
      const result = await lovableAuth.signInWithOAuth(provider, {
        redirect_uri: opts?.redirect_uri,
        extraParams: {
          ...opts?.extraParams,
        },
      });

      if (result.redirected || result.error) {
        return result;
      }

      try {
        // ✅ FIX: safely extract user (no TypeScript error)
        const user =
          (result as any)?.tokens?.user ||
          (result as any)?.user ||
          (result as any)?.data?.user;

        if (user) {
          const userProfile = {
            email: user.email,
            display_name:
              user.name || user.email?.split("@")[0],
          };

          await createUserProfile(user.id, userProfile);
        }
      } catch (e) {
        return {
          error: e instanceof Error ? e : new Error(String(e)),
        };
      }

      return result;
    },
  },
};