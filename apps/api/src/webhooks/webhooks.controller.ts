import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { ApiCommonErrors } from "../common/swagger/api-responses";
import { SendboxWebhookDto } from "../logistics/dto/sendbox-webhook.dto";
import { LogisticsService } from "../logistics/logistics.service";
import { WebhookHandlerService, type FlutterwaveChargeEvent, type PaystackChargeEvent } from "./webhook-handler.service";

// Inbound provider webhooks stay on the generous global rate limit: providers
// burst legitimate events and retry on 429, so throttling here risks missed
// payments. Authentication is the HMAC signature, verified in the services.
@ApiTags("webhooks")
@Controller("webhooks")
export class WebhooksController {
  constructor(
    private readonly handler: WebhookHandlerService,
    private readonly logistics: LogisticsService,
  ) {}

  @Post("paystack")
  @HttpCode(200)
  @ApiOperation({ summary: "Paystack charge webhook (HMAC signature required)" })
  @ApiResponse({
    status: 200,
    description: "Event accepted",
    schema: { example: { success: true, message: "Request successful", data: { status: "ok" } } },
  })
  @ApiCommonErrors("/api/v1/webhooks/paystack")
  async paystack(
    @Req() req: FastifyRequest & { rawBody?: Buffer },
    @Body() body: PaystackChargeEvent,
  ): Promise<{ status: string }> {
    const signature = req.headers["x-paystack-signature"] as string | undefined;
    const status = await this.handler.handlePaystackEvent(body, req.rawBody, signature);
    return { status };
  }

  @Post("flutterwave")
  @HttpCode(200)
  @ApiOperation({ summary: "Flutterwave charge webhook (verif-hash required)" })
  @ApiResponse({
    status: 200,
    description: "Event accepted",
    schema: { example: { success: true, message: "Request successful", data: { status: "ok" } } },
  })
  @ApiCommonErrors("/api/v1/webhooks/flutterwave")
  async flutterwave(
    @Req() req: FastifyRequest,
    @Body() body: FlutterwaveChargeEvent,
  ): Promise<{ status: string }> {
    const signature = req.headers["verif-hash"] as string | undefined;
    const status = await this.handler.handleFlutterwaveEvent(body, signature);
    return { status };
  }

  @Post("sendbox")
  @HttpCode(200)
  @ApiOperation({ summary: "Sendbox tracking webhook (signature required)" })
  @ApiResponse({
    status: 200,
    description: "Event accepted",
    schema: { example: { success: true, message: "Request successful", data: { status: "ok" } } },
  })
  @ApiCommonErrors("/api/v1/webhooks/sendbox")
  async sendbox(
    @Req() req: FastifyRequest & { rawBody?: Buffer },
    @Body() body: SendboxWebhookDto,
  ): Promise<{ status: string }> {
    const signature = req.headers["x-sendbox-signature"] as string | undefined;
    const status = await this.logistics.handleSendboxWebhook(signature, req.rawBody, body);
    return { status };
  }
}
