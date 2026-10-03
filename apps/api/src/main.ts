import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import helmet from "@fastify/helmet";
import { ZodValidationPipe } from "nestjs-zod";
import { AppModule } from "./app.module";
import { registerRawBodyParser } from "./common/http/raw-body";
import { registerRequestIdHook } from "./common/middleware/request-id.middleware";
import { SanitizePipe } from "./common/pipes/sanitize.pipe";
import type { Env } from "./config/env.validation";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
    { bufferLogs: false },
  );

  const config = app.get(ConfigService<Env, true>);
  const port = config.get("PORT", { infer: true });
  const webUrl = config.get("WEB_URL", { infer: true });
  const adminUrl = config.get("ADMIN_URL", { infer: true });

  await app.register(helmet);
  registerRawBodyParser(app.getHttpAdapter().getInstance());
  registerRequestIdHook(app.getHttpAdapter().getInstance());
  app.enableCors({ origin: [webUrl, adminUrl], credentials: true });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ZodValidationPipe(), new SanitizePipe());

  await app.listen(port, "0.0.0.0");
  Logger.log(`API listening on port ${port}`, "Bootstrap");
}

void bootstrap();
