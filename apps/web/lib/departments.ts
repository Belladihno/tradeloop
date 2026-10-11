// Static department shortcuts shared by the hero select and the header nav.
// Slugs mirror the backend slugify rule (lowercase, non-alphanumerics to
// hyphens); unknown slugs resolve to an empty listing, never an error.
export const DEPARTMENTS = [
  { name: "All Departments", slug: "" },
  { name: "Phones & Gadgets", slug: "phones-gadgets" },
  { name: "Laptops & Tech", slug: "laptops-tech" },
  { name: "Fashion & Apparel", slug: "fashion-apparel" },
  { name: "Solar & Power", slug: "solar-power" },
  { name: "Home & Office", slug: "home-office" },
] as const;
