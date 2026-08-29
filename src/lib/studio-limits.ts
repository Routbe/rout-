/**
 * Studio limieten — pure regels, geen I/O.
 *
 * Drie niveaus:
 *   guest    — niet ingelogd: mag ontwerpen en exporteren, maar geen trackbare
 *              korte links maken (die vragen eigenaarschap).
 *   member   — ingelogd: eigen korte links met gegenereerde Base36-code.
 *   verified — geverifieerd of betalend: eigen (vanity) codes en veel meer links.
 *
 * Gedeeld door de UI en de databank-trigger, zodat de grenzen niet uiteenlopen.
 */
import { fitsVersion1, qrPayloadForSlug } from "@/lib/base36";

export type StudioTier = "guest" | "member" | "verified";

export type StudioLimits = {
  /** Mag een trackbare korte link aanmaken. */
  canCreateShortLink: boolean;
  /** Mag een zelfgekozen (vanity) code claimen. */
  canPickVanitySlug: boolean;
  /** Maximum aantal actieve korte links. */
  maxShortLinks: number;
  /** Maximum aantal nieuwe links per uur (spam-rem). */
  maxShortLinksPerHour: number;
  /** Maximum aantal rijen in een batch-export. */
  maxBatchRows: number;
};

export const STUDIO_LIMITS: Record<StudioTier, StudioLimits> = {
  guest: {
    canCreateShortLink: false,
    canPickVanitySlug: false,
    maxShortLinks: 0,
    maxShortLinksPerHour: 0,
    maxBatchRows: 10,
  },
  member: {
    canCreateShortLink: true,
    canPickVanitySlug: false,
    maxShortLinks: 25,
    maxShortLinksPerHour: 10,
    maxBatchRows: 100,
  },
  verified: {
    canCreateShortLink: true,
    canPickVanitySlug: true,
    maxShortLinks: 1000,
    maxShortLinksPerHour: 60,
    maxBatchRows: 5000,
  },
};

export type TierInput = {
  signedIn: boolean;
  verified?: boolean | null;
  isPaid?: boolean | null;
  isEarlyBeliever?: boolean | null;
};

export function studioTier(input: TierInput): StudioTier {
  if (!input.signedIn) return "guest";
  if (input.verified === true || input.isPaid === true || input.isEarlyBeliever === true) {
    return "verified";
  }
  return "member";
}

export function limitsFor(input: TierInput): StudioLimits {
  return STUDIO_LIMITS[studioTier(input)];
}

/** Menselijke uitleg waarom een aanmaak geweigerd wordt, of `null` als het mag. */
export function shortLinkBlockReason(
  input: TierInput,
  currentCount: number,
  wantsVanitySlug = false,
): string | null {
  const limits = limitsFor(input);
  if (!limits.canCreateShortLink) {
    return "Meld je aan om een trackbare korte link te maken.";
  }
  if (currentCount >= limits.maxShortLinks) {
    return `Je hebt het maximum van ${limits.maxShortLinks} actieve korte links bereikt.`;
  }
  if (wantsVanitySlug && !limits.canPickVanitySlug) {
    return "Een zelfgekozen code hoort bij een geverifieerd account — je krijgt nu een korte ROUT-code.";
  }
  return null;
}

/**
 * Strikte 21×21-indicator (QR Version 1).
 *
 * Version 1 heeft exact 21×21 modules en dat is de scherpste, snelst
 * scanbare code. De payload moet dan volledig in de alphanumeric-subset
 * blijven en maximaal 20 tekens lang zijn.
 */
export type CanvasCheck = {
  /** Aantal modules per zijde van het strikte doel. */
  modules: 21;
  /** Past de payload nog in Version 1? */
  fits: boolean;
  payload: string;
  length: number;
  /** Maximale payloadlengte voor Version 1-M in alphanumeric mode. */
  capacity: 20;
  reason: string | null;
};

export function checkVersion1Canvas(payload: string): CanvasCheck {
  const value = payload ?? "";
  const fits = fitsVersion1(value);
  const tooLong = value.length > 20;
  return {
    modules: 21,
    fits,
    payload: value,
    length: value.length,
    capacity: 20,
    reason: fits
      ? null
      : tooLong
        ? `${value.length} tekens — Version 1 houdt op bij 20.`
        : "Kleine letters of speciale tekens duwen de code naar byte mode (Version 2+).",
  };
}

/** Handige wrapper: check meteen op basis van een slug. */
export function checkSlugCanvas(slug: string, origin?: string): CanvasCheck {
  return checkVersion1Canvas(qrPayloadForSlug(slug, origin));
}
