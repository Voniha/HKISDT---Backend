// Error.ts
import Logger from "../utils/logger";

declare global {
  // eslint-disable-next-line no-var
  var __errorHandlingInstalled__: boolean | undefined;
}

export function setupGlobalErrorHandling(logger?: Logger) {
  if (globalThis.__errorHandlingInstalled__) return;
  globalThis.__errorHandlingInstalled__ = true;

  const base = logger ?? new Logger((process.env.LOG_LEVEL as any) || "info", "Error");
  const log = base.child("global");

  process.on("unhandledRejection", (reason) => {
    log.error("unhandledRejection", { reason });
  });

  process.on("uncaughtException", (err, origin) => {
    log.error("uncaughtException", { error: err, origin });
    setImmediate(() => {});
  });

  process.on("rejectionHandled", () => {
    log.info("rejectionHandled");
  });

  process.on("uncaughtExceptionMonitor", (err, origin) => {
    log.warn("uncaughtExceptionMonitor", { error: err, origin });
  });

  process.on("beforeExit", (code) => {
    log.info("beforeExit", { code });
  });
}
