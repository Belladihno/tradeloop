import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { RequestUser } from "../auth/types";
import { ApiCommonErrors } from "../common/swagger/api-responses";
import { WriteThrottle } from "../common/throttle/rate-limit";
import { CreateShipmentDto } from "./dto/create-shipment.dto";
import { ShippingRateDto } from "./dto/shipping-rate.dto";
import { LogisticsService } from "./logistics.service";

@ApiTags("shipments")
@ApiBearerAuth()
@Controller("shipments")
@UseGuards(JwtAuthGuard)
export class LogisticsController {
  constructor(private readonly logistics: LogisticsService) {}

  @Post()
  @WriteThrottle()
  @ApiOperation({ summary: "Book a shipment for an order" })
  @ApiBody({
    schema: {
      example: {
        orderId: "0193e2c0-7a2e-7a2e-8a2e-8a2e8a2e8a2e",
        pickupLga: "Ikeja",
        deliveryLga: "Wuse II",
        weightKg: 2.5,
        recipientName: "Ada Obi",
        recipientPhone: "+2348012345678",
        recipientAddress: "14 Allen Avenue, Ikeja",
      },
    },
  })
  @ApiResponse({ status: 201, description: "Shipment booked with tracking number" })
  @ApiCommonErrors("/api/v1/shipments")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateShipmentDto) {
    return this.logistics.createShipment(user.id, dto);
  }

  @Get("rate")
  @ApiOperation({ summary: "Get a shipping rate quote" })
  @ApiResponse({ status: 200, description: "Rate quote" })
  @ApiCommonErrors("/api/v1/shipments/rate")
  rate(@Query() query: ShippingRateDto) {
    return this.logistics.calculateRate(query);
  }

  @Get(":trackingNumber/track")
  @ApiOperation({ summary: "Track a shipment by tracking number" })
  @ApiResponse({ status: 200, description: "Tracking events" })
  @ApiCommonErrors("/api/v1/shipments/:trackingNumber/track")
  track(@Param("trackingNumber") trackingNumber: string) {
    return this.logistics.trackShipment(trackingNumber);
  }
}
