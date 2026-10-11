// Material Symbol per category, matching the Stitch landing artwork.
// Unknown slugs fall back to the storefront glyph — never blank.
const ICONS: Array<{ match: RegExp; icon: string }> = [
  { match: /audio|sound|headphone|speaker/i, icon: "headphones" },
  { match: /phone|gadget|tablet/i, icon: "smartphone" },
  { match: /laptop|comput|tech/i, icon: "laptop_mac" },
  { match: /fashion|apparel|cloth|wear|thread/i, icon: "checkroom" },
  { match: /solar|power|energy|inverter/i, icon: "solar_power" },
  { match: /home|office|furniture|living/i, icon: "desk" },
];

export function categoryIcon(slug: string): string {
  const found = ICONS.find((entry) => entry.match.test(slug));
  return found ? found.icon : "storefront";
}
