import { createZodDto } from "nestjs-zod";
import { sendboxWebhookSchema } from "@tradeloop/validators";

export class SendboxWebhookDto extends createZodDto(sendboxWebhookSchema) {}
