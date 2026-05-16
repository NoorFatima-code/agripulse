import {
  getDatabase,
  ref,
  set,
  get,
  update,
  remove,
  query,
  orderByChild,
  equalTo,
  limitToFirst,
  limitToLast,
  onValue,
  off,
  type DatabaseReference
} from 'firebase/database';

import app from "@/firebase";

const database = getDatabase(app);

export interface NotificationData {
  user_id: string;
  title: string;
  body: string;
  type: 'success' | 'error' | 'info' | 'warning' | 'irrigation';
  timestamp?: number;
  id?: string;
}

export interface ProfileData {
  id: string;
  email?: string;
  display_name?: string;
  farm_name?: string;
  [key: string]: any;
}

// Notifications operations
export async function insertNotification(notification: NotificationData) {
  try {
    const notificationsRef = ref(database, `notifications/${Date.now()}`);
    const dataToStore = {
      ...notification,
      timestamp: notification.timestamp || Date.now()
    };
    await set(notificationsRef, dataToStore);
    return { error: null };
  } catch (error: any) {
    return {
      error: {
        message: error.message,
        code: error.code
      }
    };
  }
}

export async function getUserNotifications(userId: string) {
  try {
    const notificationsRef = ref(database, 'notifications');
    const q = query(notificationsRef, orderByChild('user_id'), equalTo(userId));
    const snapshot = await get(q);

    if (snapshot.exists()) {
      const data = snapshot.val();
      return { notifications: data, error: null };
    }
    return { notifications: null, error: null };
  } catch (error: any) {
    return {
      notifications: null,
      error: {
        message: error.message,
        code: error.code
      }
    };
  }
}

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: any) => void
) {
  const notificationsRef = ref(database, 'notifications');
  const q = query(notificationsRef, orderByChild('user_id'), equalTo(userId));

  const unsubscribe = onValue(q, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    } else {
      callback(null);
    }
  });

  return () => off(notificationsRef, 'value', unsubscribe as any);
}

// Profile operations
export async function updateUserProfile(userId: string, profileData: Partial<ProfileData>) {
  try {
    const profileRef = ref(database, `profiles/${userId}`);
    await update(profileRef, profileData);
    return { error: null };
  } catch (error: any) {
    return {
      error: {
        message: error.message,
        code: error.code
      }
    };
  }
}

export async function getUserProfile(userId: string) {
  try {
    const profileRef = ref(database, `profiles/${userId}`);
    const snapshot = await get(profileRef);

    if (snapshot.exists()) {
      return { profile: snapshot.val(), error: null };
    }
    return { profile: null, error: null };
  } catch (error: any) {
    return {
      profile: null,
      error: {
        message: error.message,
        code: error.code
      }
    };
  }
}

export async function createUserProfile(userId: string, profileData: Partial<ProfileData>) {
  try {
    const profileRef = ref(database, `profiles/${userId}`);
    const completeProfile: ProfileData = {
      id: userId,
      ...profileData
    };
    await set(profileRef, completeProfile);
    return { error: null };
  } catch (error: any) {
    return {
      error: {
        message: error.message,
        code: error.code
      }
    };
  }
}

// Generic database operations
export async function dbInsert(path: string, data: any) {
  try {
    const dbRef = ref(database, path);
    await set(dbRef, data);
    return { error: null };
  } catch (error: any) {
    return {
      error: {
        message: error.message,
        code: error.code
      }
    };
  }
}

export async function dbUpdate(path: string, updates: any) {
  try {
    const dbRef = ref(database, path);
    await update(dbRef, updates);
    return { error: null };
  } catch (error: any) {
    return {
      error: {
        message: error.message,
        code: error.code
      }
    };
  }
}

export async function dbGet(path: string) {
  try {
    const dbRef = ref(database, path);
    const snapshot = await get(dbRef);

    if (snapshot.exists()) {
      return { data: snapshot.val(), error: null };
    }
    return { data: null, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: {
        message: error.message,
        code: error.code
      }
    };
  }
}

export function dbSubscribe(path: string, callback: (data: any) => void) {
  const dbRef = ref(database, path);

  onValue(dbRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    } else {
      callback(null);
    }
  });

  return () => off(dbRef, 'value');
}
