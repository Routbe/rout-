import { createFileRoute } from "@tanstack/react-router";
import { routRabbitMarkup } from "@/lib/profile-qr";
import { parseDisplayPrefs } from "@/lib/profile-display";

/**
 * Dynamische OpenGraph-kaart (1200×630) voor profielen zonder eigen
 * uploadafbeelding. Volledig als vector-SVG gerenderd op de rand: geen
 * headless browser, geen externe render-service, geen tracking.
 */

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] ?? c,
  );
}

/** Breekt tekst af op woordgrenzen zodat de kaart nooit overloopt. */
function wrap(text: string, perLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > perLine) {
      lines.push(current.trim());
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines.slice(0, maxLines);
}

function initials(name: string) {
  return name
    .replace(/^@/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function ogSvg(input: {
  handle: string;
  name: string;
  tagline: string;
  verified: boolean;
  accent: string;
  bg: string;
  avatarUrl: string | null;
}) {
  const lines = wrap(input.tagline, 52, 2);
  const avatar = input.avatarUrl
    ? `<clipPath id="a"><circle cx="150" cy="315" r="90"/></clipPath>
       <image href="${escapeXml(input.avatarUrl)}" x="60" y="225" width="180" height="180" preserveAspectRatio="xMidYMid slice" clip-path="url(#a)"/>`
    : `<circle cx="150" cy="315" r="90" fill="${escapeXml(input.accent)}" opacity="0.18"/>
       <text x="150" y="340" text-anchor="middle" font-family="ui-sans-serif,Segoe UI,Roboto,sans-serif" font-size="64" font-weight="600" fill="${escapeXml(input.accent)}">${escapeXml(initials(input.name))}</text>`;

  const check = input.verified
    ? `<g transform="translate(${300 + Math.min(input.name.length, 24) * 23} 232)">
         <circle r="20" fill="${escapeXml(input.accent)}"/>
         <path d="M-9 1 -2 8 9 -6" fill="none" stroke="#0f0f11" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
       </g>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(input.name)} op ROUT">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${escapeXml(input.bg)}"/>
      <stop offset="100%" stop-color="${escapeXml(input.accent)}" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="18" y="18" width="1164" height="594" rx="28" fill="none" stroke="${escapeXml(input.accent)}" stroke-opacity="0.35" stroke-width="2"/>
  ${avatar}
  <text x="300" y="252" font-family="ui-serif,Georgia,serif" font-size="62" font-weight="600" fill="#F4EFE3">${escapeXml(input.name.slice(0, 26))}</text>
  ${check}
  <text x="302" y="300" font-family="ui-monospace,SFMono-Regular,monospace" font-size="30" fill="${escapeXml(input.accent)}">rout.be/${escapeXml(input.handle)}</text>
  ${lines
    .map(
      (line, i) =>
        `<text x="302" y="${356 + i * 40}" font-family="ui-sans-serif,Segoe UI,Roboto,sans-serif" font-size="28" fill="#C9C6BE">${escapeXml(line)}</text>`,
    )
    .join("")}
  <g transform="translate(1040 470) scale(0.9)">${routRabbitMarkup(input.accent)}</g>
  <text x="60" y="566" font-family="ui-sans-serif,Segoe UI,Roboto,sans-serif" font-size="22" letter-spacing="6" fill="#8A8A94">ROUT — SOEVEREINE IDENTITEIT</text>
</svg>`;
}

export const Route = createFileRoute("/api_/public/og/$handle")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const handle = String(params.handle ?? "")
          .replace(/\.(svg|png)$/i, "")
          .replace(/^@+/, "")
          .toLowerCase();
        if (!/^[a-z0-9._-]{2,40}$/.test(handle)) {
          return new Response("Invalid handle", { status: 400 });
        }

        let name = `@${handle}`;
        let tagline = "Eén soevereine link voor alles wat je maakt.";
        let verified = false;
        let accent = "#C9A84C";
        let avatarUrl: string | null = null;

        try {
          const { sql } = await import("@/lib/neon");
          const rows = (await sql`
            select display_name, tagline, bio, avatar_url, verified,
                   to_jsonb(profiles) -> 'display_prefs' as display_prefs
              from public.profiles
             where username = ${handle} and coalesce(is_banned, false) = false
             limit 1
          `) as Record<string, unknown>[];
          const row = rows[0];
          if (!row) return new Response("Not found", { status: 404 });
          const prefs = parseDisplayPrefs(row["display_prefs"]);
          name = ((row["display_name"] as string | null) || `@${handle}`).trim();
          tagline =
            prefs.metaDescription ||
            ((row["tagline"] as string | null) ?? "").trim() ||
            ((row["bio"] as string | null) ?? "").trim().slice(0, 160) ||
            tagline;
          verified = Boolean(row["verified"]);
          accent = prefs.accentColor ?? accent;
          const avatar = row["avatar_url"] as string | null;
          avatarUrl = avatar && avatar.startsWith("http") ? avatar : null;
        } catch {
          // Database onbereikbaar: toon de generieke ROUT-kaart.
        }

        return new Response(
          ogSvg({ handle, name, tagline, verified, accent, bg: "#131211", avatarUrl }),
          {
            headers: {
              "content-type": "image/svg+xml; charset=utf-8",
              "cache-control": "public, max-age=1800",
            },
          },
        );
      },
    },
  },
});
