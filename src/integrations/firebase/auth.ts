import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged,
  type User
} from "firebase/auth";

import app from "@/firebase"; // ✅ FIXED

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { auth };

export async function signUp(
  email: string,
  password: string,
  displayName?: string,
  additionalData?: Record<string, any>
) {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    if (displayName) {
      await updateProfile(userCredential.user, {
        displayName,
      });
    }

    return {
      user: userCredential.user,
      error: null,
      additionalData,
    };
  } catch (error: any) {
    return {
      user: null,
      error: {
        message: error.message,
        code: error.code,
      },
      additionalData: null,
    };
  }
}

export async function signIn(email: string, password: string) {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    return {
      user: userCredential.user,
      error: null,
    };
  } catch (error: any) {
    return {
      user: null,
      error: {
        message: error.message,
        code: error.code,
      },
    };
  }
}

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);

    return {
      user: result.user,
      error: null,
    };
  } catch (error: any) {
    return {
      user: null,
      error: {
        message: error.message,
        code: error.code,
      },
    };
  }
}

export async function logout() {
  try {
    await signOut(auth);

    return {
      error: null,
    };
  } catch (error: any) {
    return {
      error: {
        message: error.message,
        code: error.code,
      },
    };
  }
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}