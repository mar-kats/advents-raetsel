/**
 * Normalisiert deutsche Eingaben nach Option B:
 * Ä -> AE, Ö -> OE, Ü -> UE, ß -> SS, ausschließlich Großbuchstaben A-Z.
 */
export function normalizeGerman(input: string): string {
  return input
    .trim()
    .replace(/ß/g, 'SS')
    .replace(/ẞ/g, 'SS')
    .toUpperCase()
    .replace(/Ä/g, 'AE')
    .replace(/Ö/g, 'OE')
    .replace(/Ü/g, 'UE')
    .replace(/[^A-Z]/g, '');
}
