import { createZodDto } from "nestjs-zod";
import { addCartItemSchema } from "@tradeloop/validators";

export class AddCartItemDto extends createZodDto(addCartItemSchema) {}
