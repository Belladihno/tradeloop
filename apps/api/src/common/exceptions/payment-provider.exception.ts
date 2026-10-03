import { BadGatewayException } from "@nestjs/common";

export class PaymentProviderException extends BadGatewayException {
  constructor(message = "Payment provider request failed") {
    super({ message, error: "PAYMENT_PROVIDER_ERROR" });
  }
}
