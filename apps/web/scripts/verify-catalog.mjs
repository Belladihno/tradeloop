// Catalog verification harness (Golden Loop step 5).
// Mode A: drives the running web app through fetch, asserting status + markers.
// Mode B: drives the API directly for every supported query combination.
// Exits non-zero on the first failed assertion per mode, printing a FAIL line.
//
// Usage: node apps/web/scripts/verify-catalog.mjs
//   WEB_URL=http://localhost:3001  API_URL=http://127.0.0.1:3000

const WEB = process.env.WEB_URL ?? "http://localhost:3001";
const API = process.env.API_URL ?? "http://127.0.0.1:3000";

const SEED = {
  childSlug: "mobile-phones",
  searchTerm: "phone",
  minPrice: "100000",
  maxPrice: "1000000",
};

let failures = 0;

function check(ok, label, detail = "") {
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function getText(url) {
  const res = await fetch(url, { redirect: "manual" });
  const body = await res.text();
  return { status: res.status, body };
}

async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function modeA() {
  console.log(`\nMode A — web (${WEB})`);
  const cases = [
    { q: "/products", markers: ["Authenticated Marketplace Catalog", "Departments", 'data-view="grid"'] },
    { q: "/products?q=phone", markers: ["Active filters", "phone"] },
    { q: `/products?category=${SEED.childSlug}`, markers: ["Active filters", "Mobile Phones"] },
    { q: `/products?minPrice=${SEED.minPrice}&maxPrice=${SEED.maxPrice}`, markers: ["Active filters"] },
    { q: "/products?inStock=true", markers: ["In stock only"] },
    { q: "/products?sort=price_asc", markers: ["Authenticated Marketplace Catalog"] },
    { q: "/products?view=list", markers: ['data-view="list"'] },
    { q: "/products?category=does-not-exist", markers: ["No products match these filters"] },
    { q: "/products?cursor=garbage", markers: ["Could not load products right now"] },
  ];
  for (const { q, markers } of cases) {
    let res;
    try {
      res = await getText(`${WEB}${q}`);
    } catch (error) {
      check(false, `GET ${q}`, error.message);
      continue;
    }
    check(res.status === 200, `GET ${q} → 200`, `got ${res.status}`);
    for (const marker of markers) {
      check(res.body.includes(marker), `  ⌐ marker "${marker}"`);
    }
  }
}

async function modeB() {
  console.log(`\nMode B — API (${API})`);
  const list = async (query) => {
    const { status, body } = await getJson(`${API}/api/v1/products?${query}`);
    const items = body?.data?.items;
    return {
      status,
      ok: body?.success === true,
      items: Array.isArray(items) ? items : null,
      nextCursor: body?.data?.nextCursor ?? null,
    };
  };

  const all = await list("limit=20");
  check(all.status === 200 && all.ok && all.items, "list returns envelope + items", `status ${all.status}`);
  const items = all.items ?? [];
  check(items.length === 3, "seed yields 3 products", `got ${items.length}`);

  const asc = await list("limit=20&sort=price_asc");
  const ascPrices = (asc.items ?? []).map((i) => Number(i.price));
  check(
    ascPrices.every((p, i) => i === 0 || ascPrices[i - 1] <= p),
    "sort=price_asc is ascending",
    ascPrices.join(","),
  );

  const desc = await list("limit=20&sort=price_desc");
  const descPrices = (desc.items ?? []).map((i) => Number(i.price));
  check(
    descPrices.every((p, i) => i === 0 || descPrices[i - 1] >= p),
    "sort=price_desc is descending",
    descPrices.join(","),
  );

  const child = await list(`limit=20&category=${SEED.childSlug}`);
  check(
    (child.items ?? []).length > 0 && (child.items ?? []).every((i) => i.category?.slug === SEED.childSlug),
    `category=${SEED.childSlug} filters to that slug`,
    JSON.stringify((child.items ?? []).map((i) => i.category?.slug)),
  );

  const miss = await list("limit=20&category=does-not-exist");
  check((miss.items ?? []).length === 0, "unknown category → empty (not error)", `status ${miss.status}`);

  const stocked = await list("limit=20&inStock=true");
  check(
    (stocked.items ?? []).length > 0 && (stocked.items ?? []).every((i) => i.stock > 0),
    "inStock=true excludes zero-stock",
    JSON.stringify((stocked.items ?? []).map((i) => i.stock)),
  );

  const ranged = await list(`limit=20&minPrice=${SEED.minPrice}&maxPrice=${SEED.maxPrice}`);
  check(
    (ranged.items ?? []).length > 0 &&
      (ranged.items ?? []).every((i) => Number(i.price) >= Number(SEED.minPrice) && Number(i.price) <= Number(SEED.maxPrice)),
    "price range bounds respected",
    JSON.stringify((ranged.items ?? []).map((i) => i.price)),
  );

  const searched = await list(`limit=20&q=${SEED.searchTerm}`);
  check((searched.items ?? []).length > 0, `q=${SEED.searchTerm} returns matches`, `got ${(searched.items ?? []).length}`);

  const page1 = await list("limit=1&sort=price_asc");
  check(
    (page1.items ?? []).length === 1 && page1.nextCursor,
    "limit=1 yields one item + a nextCursor",
    `items ${(page1.items ?? []).length}, cursor ${page1.nextCursor}`,
  );
  if (page1.nextCursor) {
    const page2 = await list(`limit=1&sort=price_asc&cursor=${encodeURIComponent(page1.nextCursor)}`);
    check(
      page2.items?.length === 1 && page2.items[0].id !== page1.items[0].id,
      "cursor advances to a different item",
      `page2 id ${page2.items?.[0]?.id}`,
    );
  }

  const badCursor = await list("limit=1&cursor=garbage");
  check(badCursor.status === 400, "invalid cursor → 400", `status ${badCursor.status}`);

  console.log("  note  view= is client-only; buildProductQuery unit test pins it never reaches the API");
}

async function main() {
  const mode = process.argv[2] ?? "all";
  if (mode === "all" || mode === "a") await modeA();
  if (mode === "all" || mode === "b") await modeB();
  console.log(failures === 0 ? "\nRESULT: PASS" : `\nRESULT: FAIL (${failures})`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`RESULT: FAIL — ${error.message}`);
  process.exit(1);
});
