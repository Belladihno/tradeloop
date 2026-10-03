import { createZodDto } from "nestjs-zod";
import { productQuerySchema } from "@tradeloop/validators";

export class ProductQueryDto extends createZodDto(productQuerySchema) {}
