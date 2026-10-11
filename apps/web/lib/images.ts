// next/image is configured for https hosts only. Anything else (http,
// data:, javascript:, null) renders the designed fallback block instead of
// throwing through the image component into the segment boundary.
export function isDisplayableImage(url: string | null | undefined): url is string {
  return typeof url === "string" && url.startsWith("https://");
}
