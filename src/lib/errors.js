/**
 * Error de aplicacion con estado HTTP, codigo de negocio y detalles opcionales.
 * Todos los errores que llegan a la capa API se traducen a este formato.
 */
export class AppError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }

  static badRequest(code, message, details) {
    return new AppError(400, code, message, details);
  }

  static unauthorized(code, message) {
    return new AppError(401, code, message);
  }

  static forbidden(code, message) {
    return new AppError(403, code, message);
  }

  static notFound(code, message) {
    return new AppError(404, code, message);
  }

  static conflict(code, message, details) {
    return new AppError(409, code, message, details);
  }

  static tooManyRequests(code, message) {
    return new AppError(429, code, message);
  }

  static internal(message = 'Ocurrió un error inesperado.') {
    return new AppError(500, 'INTERNAL_ERROR', message);
  }
}

export function normalizeError(error) {
  if (error instanceof AppError) return error;
  return AppError.internal();
}
