/**
 * Base36 slugs voor rout.be short links.
 *
 * Waarom Base36 en HOOFDLETTERS: een QR-code schakelt alleen naar de compacte
 * *alphanumeric mode* als de payload uitsluitend uit 0-9, A-Z (hoofdletters) en
 * een paar leestekens bestaat. `HTTPS://ROUT.BE/A89K` is 20 tekens en past
 * daarmee exact in een Version 1 (21×21 modules) QR met foutcorrectie M.
 * Eén kleine letter erin en de encoder valt terug op byte mode → Version 2+.
 *
 * Opslag blijft kleine letters (de databank en `resolve_short_link` werken
 * lowercase); alleen de *weergave* en de QR-payload zijn uppercase, en
 * resolutie is dus case-insensitive.
 */

/** Base36: cijfers + hoofdletters, exact de QR alphanumeric-subset. */
export const BASE36_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Standaardlengte: 4 tekens = 36^4 = 1.679.616 combinaties. */
export const BASE36_SLUG_LENGTH = 4;

/** Maximale payloadlengte van een Version 1-M QR in alphanumeric mode. */
export const QR_V1_ALPHANUMERIC_CAPACITY = 20;

const BASE36_RE = /^[0-9A-Z]{2,32}$/;

/**
 * Cryptografisch willekeurige Base36-slug in hoofdletters.
 *
 * Er zit altijd minstens één cijfer in: zo kan een gegenereerde code nooit een
 * bestaande handle van vier letters in de root-namespace overschaduwen.
 */
export function randomBase36Slug(length: number = BASE36_SLUG_LENGTH): string {
  const bytes = new Uint8Array(length + 1);
  crypto.getRandomValues(bytes);
  const chars: string[] = [];
  for (let i = 0; i < length; i += 1) {
    chars.push(BASE36_ALPHABET[bytes[i]! % BASE36_ALPHABET.length]!);
  }
  if (!chars.some((c) => c >= "0" && c <= "9")) {
    chars[bytes[length]! % length] = String(bytes[0]! % 10);
  }
  return chars.join("");
}

/** Dwingt elke invoer naar de Base36-vorm (hoofdletters, geen rare tekens). */
export function toBase36(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 32);
}

export function isBase36Slug(input: string): boolean {
  return BASE36_RE.test(input);
}

/** Herkent een root-namespace slug (`rout.be/A89K`) i.p.v. een handle. */
export function looksLikeBase36Slug(input: string, length: number = BASE36_SLUG_LENGTH): boolean {
  return new RegExp(`^[0-9a-zA-Z]{${length}}$`).test(input) && /[0-9]/.test(input);
}

/**
 * QR-payload voor een slug: volledig uppercase zodat de encoder de
 * alphanumeric mode kiest en de code op Version 1 blijft.
 */
export function qrPayloadForSlug(slug: string, origin = "https://rout.be"): string {
  return `${origin.replace(/\/+$/, "")}/${toBase36(slug)}`.toUpperCase();
}

/** True zolang de payload binnen een Version 1-M QR past. */
export function fitsVersion1(payload: string): boolean {
  return (
    payload.length <= QR_V1_ALPHANUMERIC_CAPACITY &&
    /^[0-9A-Z$%*+\-./: ]+$/.test(payload)
  );
}
