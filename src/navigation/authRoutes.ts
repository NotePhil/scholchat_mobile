/**
 * Navigation helpers shared by the pre-login screens. Root stack: "App" (session shell →
 * AuthNavigator when logged out) + standalone screens (ForgotPassword, ResetPassword,
 * AccountCreated, deep-link screens…).
 */
type Nav = { reset: (state: any) => void };

/** Back to the login form, whatever the current stack (deep link, end of a flow…). */
export const resetToLogin = (navigation: Nav) =>
  navigation.reset({
    index: 0,
    routes: [{ name: 'App', state: { index: 0, routes: [{ name: 'Login' }] } }],
  });

/** Back to the root "App" shell only (used once a session has just been opened). */
export const resetToApp = (navigation: Nav) => navigation.reset({ index: 0, routes: [{ name: 'App' }] });
