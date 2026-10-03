import { createZodDto } from "nestjs-zod";
import { fundWalletSchema } from "@tradeloop/validators";

export class FundWalletDto extends createZodDto(fundWalletSchema) {}
