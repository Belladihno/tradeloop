import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";

export interface TestDatabase {
  getConnectionUri(): string;
  stop(): Promise<unknown>;
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const externalUrl = process.env.TEST_PG_URL;
  if (externalUrl) {
    return {
      getConnectionUri: () => externalUrl,
      stop: async () => undefined,
    };
  }
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    "postgres:alpine",
  ).start();
  return container;
}
