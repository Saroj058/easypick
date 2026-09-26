import type { Instrumentation } from "next";

// Runs once when a server starts (register) and on every server error (onRequestError).
// See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md
// Database and email code lives in instrumentation-node.ts, imported only on the Node runtime.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkEnvOnStart } = await import("./instrumentation-node");
    await checkEnvOnStart();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const error = err instanceof Error ? err : new Error(String(err));
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  // The query string can hold order or gift details; the path is enough to find the page.
  const path = request.path.split("?")[0];
  console.error(
    JSON.stringify({
      level: "error",
      event: "request_error",
      message: error.message,
      digest,
      method: request.method,
      path,
      routePath: context.routePath,
      routeType: context.routeType,
      at: new Date().toISOString(),
    }),
    error.stack ?? "",
  );

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { alertOnError } = await import("./instrumentation-node");
    await alertOnError(
      `Server error on ${context.routePath}`,
      `${request.method} ${path} (${context.routeType})\n${error.message}${digest ? `\nDigest: ${digest}` : ""}\n\nMore errors in the next 10 minutes are only in the Vercel logs.`,
    );
  }
};
