/**
 * Errors thrown as `AppError` are the ones we intend the client to see. Anything else
 * reaching the error handler is treated as an unexpected fault and reported as a generic
 * 500, so internal details never leak into a response body.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown, code = "bad_request") {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = "Authentication required", code = "unauthorized") {
    return new AppError(401, code, message);
  }

  static forbidden(message = "You do not have access to this resource", code = "forbidden") {
    return new AppError(403, code, message);
  }

  static notFound(message = "Resource not found", code = "not_found") {
    return new AppError(404, code, message);
  }

  static conflict(message = "This conflicts with existing data", code = "conflict", details?: unknown) {
    return new AppError(409, code, message, details);
  }
}
