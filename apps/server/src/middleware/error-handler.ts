import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/http-error.js";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound("No route matches this path"));
}

/**
 * body-parser rejections carry a `.type` and a status but are not `AppError`
 * instances, so without this they fall through to the generic 500 branch below
 * and the client never sees the 4xx the request actually earned.
 */
const BODY_PARSER_ERROR_TYPES: Record<string, () => AppError> = {
  "entity.too.large": () => AppError.payloadTooLarge(),
  "entity.parse.failed": () => AppError.badRequest("The request body could not be parsed"),
  "charset.unsupported": () => AppError.unsupportedMediaType(),
  "encoding.unsupported": () => AppError.unsupportedMediaType(),
};

function fromBodyParserError(error: unknown): AppError | null {
  const type = error instanceof Error ? (error as Error & { type?: unknown }).type : undefined;
  if (typeof type === "string" && type in BODY_PARSER_ERROR_TYPES) {
    return BODY_PARSER_ERROR_TYPES[type]();
  }
  return null;
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const appError = error instanceof AppError ? error : fromBodyParserError(error);
  if (appError) {
    res.status(appError.status).json({
      error: { code: appError.code, message: appError.message, details: appError.details },
    });
    return;
  }

  console.error("Unhandled error:", error);
  res.status(500).json({
    error: { code: "internal_error", message: "Something went wrong" },
  });
}
