import { BadGatewayException } from "@nestjs/common";

export class LogisticsProviderException extends BadGatewayException {
  constructor(message = "Logistics provider request failed") {
    super({ message, error: "LOGISTICS_PROVIDER_ERROR" });
  }
}
