// Static department shortcuts shared by the hero select and the header nav.
// Names and slugs mirror the Stitch hero options verbatim; unknown slugs
// resolve to an empty listing, never an error.
export const DEPARTMENTS = [
  { name: "All Departments", slug: "" },
  { name: "Phones & Tablets", slug: "phones" },
  { name: "Laptops & Tech", slug: "computing" },
  { name: "Men & Women Fashion", slug: "fashion" },
  { name: "Solar & Power Inverters", slug: "power" },
  { name: "Audio & Gadgets", slug: "audio" },
] as const;
