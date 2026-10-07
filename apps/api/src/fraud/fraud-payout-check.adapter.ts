import { Injectable } from "@nestjs/common";
import type { FraudScreening } from "@tradeloop/types";
import { toMinorUnits } from "../common/utils/money";
import type { PayoutFraudCheck } from "../payouts/payout-fraud-check.port";
import { FraudService } from "./fraud.service";

@Injectable()
export class FraudPayoutCheck implements PayoutFraudCheck {
  constructor(private readonly fraud: FraudService) {}

  async screen(sellerId: string, amount: string): Promise<FraudScreening> {
    return this.fraud.screenPayout(sellerId, toMinorUnits(amount));
  }
}
