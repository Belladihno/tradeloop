import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface SuccessEnvelope<T = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, SuccessEnvelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<SuccessEnvelope<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<{ method?: string }>();
    return next.handle().pipe(
      map((data) => {
        if (isEnvelope(data)) return data as unknown as SuccessEnvelope<T>;
        return {
          success: true as const,
          message: defaultMessage(request?.method),
          data: (data ?? {}) as T,
        };
      }),
    );
  }
}

function isEnvelope(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    (value as { success: unknown }).success === true
  );
}

function defaultMessage(method?: string): string {
  switch (method) {
    case "POST":
      return "Resource created successfully";
    case "PATCH":
    case "PUT":
      return "Resource updated successfully";
    case "DELETE":
      return "Resource deleted successfully";
    default:
      return "Request successful";
  }
}
