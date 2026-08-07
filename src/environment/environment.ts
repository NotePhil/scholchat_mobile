// EXPO_PUBLIC_API_BASE_URL is read from .env at build/start time (Expo's built-in
// env-var support). Falls back to the hosted production backend so the app
// works over WiFi/mobile data from anywhere, not just a dev machine's LAN.
const DEFAULT_PRODUCTION_BASE_URL = "https://scholchat-business-latest.onrender.com/scholchat";

export const environment = {
  baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_PRODUCTION_BASE_URL,
};
