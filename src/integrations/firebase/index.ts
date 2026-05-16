// Firebase integration exports
export { auth } from './auth';
export {
  signUp,
  signIn,
  signInWithGoogle,
  logout,
  getCurrentUser
} from './auth';
export {
  insertNotification,
  getUserNotifications,
  subscribeToNotifications,
  updateUserProfile,
  getUserProfile,
  createUserProfile,
  dbInsert,
  dbUpdate,
  dbGet,
  dbSubscribe
} from './database';
