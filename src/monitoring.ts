import * as Sentry from "@sentry/react";

export function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!dsn) {
    console.warn("Sentry DSN not found. Error monitoring is disabled.");
    return;
  }

  Sentry.init({
    dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: ["localhost", /^https:\/\/ais-.*\.run\.app/],
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    environment: import.meta.env.MODE,
  });
}

export function logError(error: any, context?: Record<string, any>) {
  console.error("Logging error to Sentry:", error, context);
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}

export function setUserContext(user: { id: string; email?: string | null; name?: string | null }) {
  Sentry.setUser({
    id: user.id,
    email: user.email || undefined,
    username: user.name || undefined,
  });
}

export function clearUserContext() {
  Sentry.setUser(null);
}
