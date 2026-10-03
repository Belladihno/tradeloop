import { createZodDto } from "nestjs-zod";
import { createOrderSchema } from "@tradeloop/validators";

export class CreateOrderDto extends createZodDto(createOrderSchema) {}
