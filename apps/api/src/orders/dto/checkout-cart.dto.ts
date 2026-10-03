import { createZodDto } from "nestjs-zod";
import { checkoutCartSchema } from "@tradeloop/validators";

export class CheckoutCartDto extends createZodDto(checkoutCartSchema) {}
