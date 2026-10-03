import { createZodDto } from "nestjs-zod";
import { updateProductSchema } from "@tradeloop/validators";

export class UpdateProductDto extends createZodDto(updateProductSchema) {}
