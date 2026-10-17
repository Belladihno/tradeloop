// Local dev seed: a throwaway seller, two departments (one nested), and three
// products so the catalog can be exercised against realistic data.
// Idempotent — fixed UUIDs with ON CONFLICT DO NOTHING; re-runnable.
//
// Usage: node apps/api/scripts/seed-dev.mjs

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(resolve(root, ".env"), "utf8");
  const line = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL not found in environment or .env");
  return line.slice("DATABASE_URL=".length).trim();
}

const SELLER = "00000000-0000-4000-8000-000000000001";
const CAT_ROOT = "00000000-0000-4000-8000-000000000101";
const CAT_CHILD = "00000000-0000-4000-8000-000000000102";

const PRODUCTS = [
  { id: "00000000-0000-4000-8000-000000000201", name: "Aurora X1 Smartphone", slug: "aurora-x1-smartphone", price: "350000.00", stock: 5 },
  { id: "00000000-0000-4000-8000-000000000202", name: "Nova Book 14 Laptop", slug: "nova-book-14-laptop", price: "1500000.00", stock: 0 },
  { id: "00000000-0000-4000-8000-000000000203", name: "Vault Phone Case", slug: "vault-phone-case", price: "15000.00", stock: 12 },
];

const client = new pg.Client({ connectionString: databaseUrl() });

async function main() {
  await client.connect();
  await client.query(
    `INSERT INTO "users" ("id", "email", "role", "is_verified")
     VALUES ($1, $2, 'SELLER', true) ON CONFLICT ("id") DO NOTHING`,
    [SELLER, "seed-seller@tradeloop.local"],
  );
  await client.query(
    `INSERT INTO "categories" ("id", "name", "slug", "parent_id")
     VALUES ($1, 'Phones & Computing', 'phones-computing', NULL) ON CONFLICT ("id") DO NOTHING`,
    [CAT_ROOT],
  );
  await client.query(
    `INSERT INTO "categories" ("id", "name", "slug", "parent_id")
     VALUES ($1, 'Mobile Phones', 'mobile-phones', $2) ON CONFLICT ("id") DO NOTHING`,
    [CAT_CHILD, CAT_ROOT],
  );

  let inserted = 0;
  for (const p of PRODUCTS) {
    const result = await client.query(
      `INSERT INTO "products" ("id", "seller_id", "category_id", "name", "slug", "description", "price", "stock")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT ("id") DO NOTHING`,
      [p.id, SELLER, CAT_CHILD, p.name, p.slug, `Seeded ${p.name} for local catalog verification.`, p.price, p.stock],
    );
    inserted += result.rowCount;
  }

  console.log(`seed: seller 1, categories 2, products inserted ${inserted}/${PRODUCTS.length}`);
}

main()
  .then(() => client.end())
  .catch(async (error) => {
    console.error(`seed failed: ${error.message}`);
    await client.end();
    process.exit(1);
  });
