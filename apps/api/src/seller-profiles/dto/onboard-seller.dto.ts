import { createZodDto } from "nestjs-zod";
import { onboardSellerSchema } from "@tradeloop/validators";

export class OnboardSellerDto extends createZodDto(onboardSellerSchema) {}
