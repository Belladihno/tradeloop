import { Module } from "@nestjs/common";
import { PaymentService } from "./payment.service";
import { FlutterwaveProvider } from "./providers/flutterwave.provider";
import { PaystackProvider } from "./providers/paystack.provider";

@Module({
  providers: [PaymentService, PaystackProvider, FlutterwaveProvider],
  exports: [PaymentService, PaystackProvider, FlutterwaveProvider],
})
export class PaymentsModule {}
