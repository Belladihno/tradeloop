import { Controller, Get, Sse, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Observable } from "rxjs";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestUser } from "../auth/types";
import { ApiCommonErrors } from "../common/swagger/api-responses";
import { NotificationStream, type InAppEvent } from "./notification-stream";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly stream: NotificationStream,
  ) {}

  @Sse("stream")
  @ApiOperation({ summary: "Subscribe to live in-app events (server-sent events)" })
  @ApiResponse({ status: 200, description: "Event stream (text/event-stream)" })
  @ApiCommonErrors("/api/v1/notifications/stream")
  streamEvents(@CurrentUser() user: RequestUser): Observable<InAppEvent> {
    return this.stream.subscribe(user.id).asObservable();
  }

  @Get("mine")
  @ApiOperation({ summary: "List my notifications" })
  @ApiResponse({ status: 200, description: "My notifications" })
  @ApiCommonErrors("/api/v1/notifications/mine")
  listMine(@CurrentUser() user: RequestUser) {
    return this.notifications.listMine(user.id);
  }
}
