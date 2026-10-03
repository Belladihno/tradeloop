import { createZodDto } from "nestjs-zod";
import { updateCartItemSchema } from "@tradeloop/validators";

export class UpdateCartItemDto extends createZodDto(updateCartItemSchema) {}
