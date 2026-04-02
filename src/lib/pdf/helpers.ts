const DEVANAGARI_REGEX = /[\u0900-\u097f]/;

export function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function containsDevanagari(text: string): boolean {
  return DEVANAGARI_REGEX.test(text);
}

export function cleanPdfTextLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\u0000/g, "").trim())
    .filter(Boolean)
    .filter((line) => !/^\d+\s+www\.visionias\.in/i.test(line))
    .filter((line) => !/^www\.visionias\.in$/i.test(line))
    .filter((line) => !/^(?:\u00c2)?\u00a9\s*vision\s*ias$/i.test(line))
    .filter((line) => !/^visionias$/i.test(line))
    .filter((line) => !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line));
}
