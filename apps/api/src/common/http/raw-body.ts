import type { FastifyInstance } from "fastify";

export function registerRawBodyParser(instance: FastifyInstance): void {
  instance.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (request, payload, done) => {
      (request as unknown as { rawBody?: Buffer }).rawBody = payload as Buffer;
      try {
        done(null, JSON.parse((payload as Buffer).toString("utf8")));
      } catch (error) {
        done(error as Error);
      }
    },
  );
}
