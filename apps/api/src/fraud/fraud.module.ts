import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FlaggedEvent } from "./entities/flagged-event.entity";
import { FraudRule } from "./entities/fraud-rule.entity";
import { FlaggedEventsRepository } from "./flagged-events.repository";
import { FraudRulesRepository } from "./fraud-rules.repository";
import { FraudPayoutCheck } from "./fraud-payout-check.adapter";
import { FraudService } from "./fraud.service";

@Module({
  imports: [TypeOrmModule.forFeature([FraudRule, FlaggedEvent])],
  providers: [FraudService, FraudRulesRepository, FlaggedEventsRepository, FraudPayoutCheck],
  exports: [FraudService, FraudPayoutCheck],
})
export class FraudModule {}
