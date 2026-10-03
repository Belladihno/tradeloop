import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";

export interface ErrorEnvelope {
  success: false;
  error: string;
  message: string;
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exception");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      status: (code: number) => { send: (body: unknown) => void };
    }>();
    const request = ctx.getRequest<{
      url?: string;
      method?: string;
      requestId?: string;
    }>();

    const { status, code, message } = this.normalize(exception);
    const path = request?.url ?? "";
    const requestId = request?.requestId ? ` [${request.requestId}]` : "";

    if (status >= 500) {
      this.logger.error(
        `${request?.method} ${path}${requestId} -> ${status} ${code}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request?.method} ${path}${requestId} -> ${status} ${code}`);
    }

    const body: ErrorEnvelope = {
      success: false,
      error: code,
      message,
      timestamp: new Date().toISOString(),
      path,
    };
    response.status(status).send(body);
  }

  private normalize(exception: unknown): { status: number; code: string; message: string } {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      return {
        status: exception.getStatus(),
        code: extractCode(res, exception.name),
        message: extractMessage(res, exception.message),
      };
    }
    if (isPostgresError(exception)) {
      if (exception.code === "23505") {
        return {
          status: HttpStatus.CONFLICT,
          code: "DUPLICATE_ENTRY",
          message: "A record with these details already exists",
        };
      }
      if (exception.code === "23503") {
        return {
          status: HttpStatus.BAD_REQUEST,
          code: "REFERENCE_NOT_FOUND",
          message: "Referenced record does not exist",
        };
      }
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    };
  }
}

function extractMessage(res: unknown, fallback: string): string {
  if (typeof res === "string") return res;
  if (typeof res === "object" && res !== null && "message" in res) {
    const message = (res as { message: unknown }).message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(", ");
  }
  return fallback;
}

function extractCode(res: unknown, exceptionName: string): string {
  if (typeof res === "object" && res !== null && "error" in res) {
    return String((res as { error: unknown }).error)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_");
  }
  return (
    exceptionName
      .replace(/Exception$/, "")
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .toUpperCase() || "ERROR"
  );
}

function isPostgresError(e: unknown): e is { code: string } {
  return typeof e === "object" && e !== null && "code" in e;
}
