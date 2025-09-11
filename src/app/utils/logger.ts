import chalk from "chalk";
import { inspect } from "util";
import type { RequestHandler } from "express";
import type { TokenIndexer } from "morgan";
import morgan from "morgan";

type LogLevel = "error" | "warn" | "info" | "debug";

export default class Logger {
  private level: LogLevel;
  private levels: LogLevel[] = ["error", "warn", "info", "debug"];
  private colors: Record<LogLevel, (t: string) => string> = {
    error: (t) => chalk.red.bold(t),
    warn: (t) => chalk.yellow(t),
    info: (t) => chalk.blue(t),
    debug: (t) => chalk.gray(t),
  };

  constructor(level: LogLevel = "info", private context?: string) {
    this.level = this.levels.includes(level) ? level : "info";
  }

  setLevel(level: LogLevel) {
    if (this.levels.includes(level)) this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  child(context: string): Logger {
    const ctx = this.context ? `${this.context}::${context}` : context;
    return new Logger(this.level, ctx);
  }

  error(message: any, ...meta: any[]) {
    this.log("error", message, ...meta);
  }

  warn(message: any, ...meta: any[]) {
    this.log("warn", message, ...meta);
  }

  info(message: any, ...meta: any[]) {
    this.log("info", message, ...meta);
  }

  debug(message: any, ...meta: any[]) {
    this.log("debug", message, ...meta);
  }

  log(level: LogLevel, message: any, ...meta: any[]) {
    if (!this.shouldLog(level)) return;
    const out = this.format(level, message, meta);
    if (level === "error") console.error(out);
    else console.log(out);
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels.indexOf(level) <= this.levels.indexOf(this.level);
  }

  private format(level: LogLevel, message: any, meta: any[]): string {
    const ts = new Date().toISOString();
    const ctx = this.context ? `[${this.context}] ` : "";
    let body: string;
    if (message instanceof Error) body = message.stack ?? message.message;
    else if (typeof message === "object")
      body = inspect(message, { depth: null, compact: true });
    else body = String(message);
    const metaStr =
      meta && meta.length
        ? " " +
          meta
            .map((m) =>
              typeof m === "object" ? inspect(m, { depth: 1 }) : String(m)
            )
            .join(" ")
        : "";
    const lvl = level.toUpperCase().padEnd(5);
    return `${chalk.dim(`[${ts}]`)} ${this.colors[level](
      lvl
    )} ${ctx}${body}${metaStr}`;
  }

  /**
   * Morgan custom format funkcija da se uklopi sa Logger-om
   */
  morganMiddleware(): any {
  return morgan((tokens, req: any, res) => {
    const status = Number(tokens.status(req, res));
    const statusColor =
      status >= 500
        ? chalk.red
        : status >= 400
        ? chalk.yellow
        : status >= 300
        ? chalk.cyan
        : chalk.green;

    const ip = (req.ip || "").replace("::ffff:", "");
    const method = chalk.gray(tokens.method(req, res));
    const url = chalk.white(tokens.url(req, res));
    const code = statusColor(String(status));
    const length = chalk.blue(tokens.res(req, res, "content-length") || "0");
    const time = chalk.magenta(tokens["response-time"](req, res) + " ms");
    const ua = chalk.dim(req.headers["user-agent"] || "-");

    const msg = `${method} ${url} ${code} ${length} - ${time} ${chalk.gray(ip)} ${ua}`;

    if (status >= 500) this.error(msg);
    else if (status >= 400) this.warn(msg);
    else this.info(msg);

    return null;
  });
  }
}
