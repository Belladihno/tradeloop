import { createZodDto } from "nestjs-zod";
import { shippingRateSchema } from "@tradeloop/validators";

export class ShippingRateDto extends createZodDto(shippingRateSchema) {}
