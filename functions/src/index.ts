// Firebase Cloud Functions entry point
// All functions are exported from their respective modules

export { optimizeSchedule } from './ai/optimizer.js';
export {
  createRazorpaySubscription,
  verifyRazorpayPayment,
  cancelRazorpaySubscription,
  razorpayWebhook,
} from './razorpay/webhooks.js';
export {
  getGCalAuthUrl,
  gcalOAuthCallback,
  syncGoogleCalendar,
} from './gcal/sync.js';
export { updateHabitStreaks } from './scheduled/streaks.js';
