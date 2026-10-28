import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  enableLogs: true,

  integrations: [Sentry.replayIntegration()],

  tracePropagationTargets: [
    "localhost",
    ...(process.env.NEXT_PUBLIC_API_BASE_URL
      ? [process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, "")]
      : []),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
