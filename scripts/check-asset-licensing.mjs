// Fails if game files or copies of locally imported game assets would be committed.
//
// 1. No raw game data in the repository (.dat/.tex/CASC/BLTE files, asset caches).
// 2. No committed image may be byte-identical to an asset in the local import cache
//    (%LOCALAPPDATA%\Grimtome\assets\current\manifest.json), when that cache exists.
//
// Usage: node scripts/check-asset-licensing.mjs   (runs in CI and before releases)

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .map((f) => f.trim())
  .filter(Boolean)
  .filter((f) => existsSync(f));

const problems = [];

const FORBIDDEN_EXT = /\.(dat|tex|idx|blte|casc|index|sno|stl|pak|mpq)$/i;
const FORBIDDEN_PATH = /(^|\/)(local-assets|assets\/current|assets\/user|Grimtome\/assets)(\/|$)/i;
for (const f of files) {
  if (FORBIDDEN_EXT.test(f)) problems.push(`${f}: raw game data file type`);
  if (FORBIDDEN_PATH.test(f)) problems.push(`${f}: inside an imported-asset cache folder`);
}

const cache = join(process.env.LOCALAPPDATA ?? '', 'Grimtome', 'assets', 'current', 'manifest.json');
let compared = 0;
if (process.env.LOCALAPPDATA && existsSync(cache)) {
  const manifest = JSON.parse(readFileSync(cache, 'utf8'));
  const gameHashes = new Map(Object.entries(manifest.assets ?? {}).map(([id, a]) => [a.sha256, id]));
  for (const f of files.filter((x) => /\.(png|jpe?g|webp|gif|bmp|dds)$/i.test(x))) {
    compared++;
    const sha = createHash('sha256').update(readFileSync(f)).digest('hex');
    if (gameHashes.has(sha)) problems.push(`${f}: identical to imported game asset "${gameHashes.get(sha)}"`);
  }
}

if (problems.length) {
  console.error(`Asset licensing check failed (${problems.length}):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('Game assets are imported locally by each user and must never be committed.');
  process.exit(1);
}
console.log(
  `Asset licensing check passed: ${files.length} files scanned` +
    (compared
      ? `, ${compared} images compared against the local game asset cache.`
      : ' (no local game asset cache to compare against).'),
);
