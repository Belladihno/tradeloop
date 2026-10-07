import { createZodDto } from "nestjs-zod";
import { updateFraudRuleSchema } from "@tradeloop/validators";

export class UpdateFraudRuleDto extends createZodDto(updateFraudRuleSchema) {}
