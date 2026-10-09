import { applyDecorators } from "@nestjs/common";
import { ApiResponse } from "@nestjs/swagger";

function errorExample(error: string, message: string, path: string): object {
  return {
    value: {
      success: false,
      error,
      message,
      timestamp: "2026-01-01T00:00:00.000Z",
      path,
    },
  };
}

// Documents the error responses every endpoint can produce through the
// global exception filter and guards. Pass the path for accurate examples.
export const ApiCommonErrors = (path: string): MethodDecorator & ClassDecorator =>
  applyDecorators(
    ApiResponse({
      status: 400,
      description: "Validation failed or bad request",
      content: {
        "application/json": {
          examples: {
            validation: errorExample(
              "BAD_REQUEST",
              "email must be an email, password is required",
              path,
            ),
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: "Missing or invalid credentials",
      content: {
        "application/json": {
          examples: {
            unauthorized: errorExample("UNAUTHORIZED", "Unauthorized", path),
          },
        },
      },
    }),
    ApiResponse({
      status: 403,
      description: "Authenticated but not allowed",
      content: {
        "application/json": {
          examples: {
            forbidden: errorExample("FORBIDDEN", "You do not have access to this order", path),
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: "Resource not found",
      content: {
        "application/json": {
          examples: {
            notFound: errorExample("NOT_FOUND", "Product not found", path),
          },
        },
      },
    }),
    ApiResponse({
      status: 409,
      description: "State conflict or duplicate",
      content: {
        "application/json": {
          examples: {
            conflict: errorExample(
              "ORDER_STATE_INVALID",
              "Only pending orders can be cancelled",
              path,
            ),
          },
        },
      },
    }),
    ApiResponse({
      status: 422,
      description: "Business rule rejected the request",
      content: {
        "application/json": {
          examples: {
            businessRule: errorExample(
              "INSUFFICIENT_FUNDS",
              "Wallet balance is too low for this order",
              path,
            ),
          },
        },
      },
    }),
    ApiResponse({
      status: 429,
      description: "Rate limit exceeded",
      content: {
        "application/json": {
          examples: {
            throttled: errorExample("TOO_MANY_REQUESTS", "Too Many Requests", path),
          },
        },
      },
    }),
  );
