import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { HealthService, type HealthReport } from "./health.service";

@ApiTags("health")
@Controller("health")
@SkipThrottle()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: "Liveness plus database, Redis, and Supabase status" })
  @ApiResponse({
    status: 200,
    description: "Service status",
    schema: {
      example: {
        success: true,
        message: "Request successful",
        data: {
          status: "ok",
          checks: { database: "up", redis: "up", supabase: "up" },
        },
      },
    },
  })
  check(): Promise<HealthReport> {
    return this.health.check();
  }
}
