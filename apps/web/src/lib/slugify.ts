export function slugify(text: string): string {
  return String(text)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\uAC00-\uD7A3\u3131-\u318E-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}
