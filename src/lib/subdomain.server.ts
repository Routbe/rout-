/**
 * Wildcard-subdomain routing for *.rout.be.
 *
 * A request to `j.delplanche.rout.be` is resolved from the Host header:
 *  - `/.well-known/atproto-did` is answered by the dedicated route (AT Protocol verification)
 *  - a human visitor either sees the ROUT profile or gets a 302 to Bluesky,
 *    depending on the user's `redirect_target` preference.
 */
import { sql } from "@/lib/neon";

const ROOT_DOMAINS = ["rout.be"];
const SYSTEM_SUBDOMAINS = new Set([
  "www",
  "api",
  "app",
  "admin",
  "mail",
  "cdn",
  "static",
  "preview",
  "dev",
]);

export function subdomainFromHost(host: string | null): string | null {
  if (!host) return null;
  const clean = host.split(":")[0].toLowerCase();
  const root = ROOT_DOMAINS.find((d) => clean === d || clean.endsWith(`.${d}`));
  if (!root || clean === root) return null;
  const sub = clean.slice(0, -(root.length + 1));
  if (!sub || SYSTEM_SUBDOMAINS.has(sub)) return null;
  return sub;
}

/** Handle → profile handle. Dots in a subdomain map to hyphens in the handle. */
export const subdomainToHandle = (sub: string) => sub.replace(/\./g, "-");

type SubProfile = {
  username: string | null;
  verified: boolean | null;
  subdomain_enabled: boolean | null;
  redirect_target: string | null;
  bluesky_did: string | null;
};

type Row = Record<string, unknown>;

export async function lookupSubdomainProfile(sub: string): Promise<SubProfile | null> {
  const rows = (await sql`
    select username, verified, subdomain_enabled, redirect_target, bluesky_did
      from public.profiles
     where username = ${subdomainToHandle(sub)}
     limit 1
  `) as Row[];
  return (rows[0] as unknown as SubProfile) ?? null;
}

/** Returns a Response when the request should be handled as a subdomain request. */
export async function handleSubdomainRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const sub = subdomainFromHost(request.headers.get("host"));
  if (!sub) return null;
  if (url.pathname !== "/") return null;

  let profile: SubProfile | null = null;
  try {
    profile = await lookupSubdomainProfile(sub);
  } catch {
    return null;
  }
  if (!profile?.username || !profile.subdomain_enabled) return null;

  const target =
    profile.redirect_target === "bluesky" && profile.bluesky_did
      ? `https://bsky.app/profile/${sub}.rout.be`
      : profile.verified
        ? `${url.origin.replace(`${sub}.`, "")}/@${profile.username}`
        : `${url.origin.replace(`${sub}.`, "")}/u/@${profile.username}`;

  return new Response(null, {
    status: 302,
    headers: { Location: target, "Cache-Control": "no-store" },
  });
}

export type SubdomainSettings = {
  username: string | null;
  subdomainEnabled: boolean;
  redirectTarget: string;
  blueskyDid: string | null;
};

/** Reads the subdomain panel's current state for the signed-in member. */
export async function readSubdomainSettings(userId: string): Promise<SubdomainSettings> {
  const rows = (await sql`
    select username, subdomain_enabled, redirect_target, bluesky_did
      from public.profiles
     where id = ${userId}
     limit 1
  `) as Row[];
  const row = rows[0];
  return {
    username: (row?.["username"] as string | null) ?? null,
    subdomainEnabled: Boolean(row?.["subdomain_enabled"]),
    redirectTarget: (row?.["redirect_target"] as string | null) ?? "rout_profile",
    blueskyDid: (row?.["bluesky_did"] as string | null) ?? null,
  };
}

/** Autosaves the subdomain toggle + redirect target + Bluesky DID. */
export async function writeSubdomainSettings(
  userId: string,
  input: { enabled: boolean; target: "rout_profile" | "bluesky"; did: string | null },
) {
  await sql`
    update public.profiles
       set subdomain_enabled = ${input.enabled},
           redirect_target = ${input.target},
           bluesky_did = ${input.did && input.did.trim() ? input.did.trim() : null},
           updated_at = now()
     where id = ${userId}
  `;
}
