/**
 * Maxroll links — attribution only.
 *
 * Maxroll's robots.txt disallows automated access to `/d4/planner/*` and its
 * notice prohibits automated scraping without written permission, so Grimtome
 * never fetches Maxroll pages or APIs. A link is validated and stored with the
 * build so the player can open the guide in their browser and copy what they
 * need into the "paste a guide" importer. See docs/COMPLIANCE.md.
 */

export interface MaxrollLink {
  url: string;
  kind: 'guide' | 'planner' | 'other';
  slug: string | null;
}

export function parseMaxrollUrl(input: string): MaxrollLink | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || !/(^|\.)maxroll\.gg$/i.test(u.hostname)) return null;
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts[0]?.toLowerCase() !== 'd4') return null;
  const kind = parts[1] === 'build-guides' ? 'guide' : parts[1] === 'planner' ? 'planner' : 'other';
  return { url: `https://maxroll.gg${u.pathname}${u.hash}`, kind, slug: parts[2] ?? null };
}
