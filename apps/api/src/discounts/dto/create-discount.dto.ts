import { createZodDto } from "nestjs-zod";
import { createDiscountSchema } from "@tradeloop/validators";

export class CreateDiscountDto extends createZodDto(createDiscountSchema) {}
