/**
 * Renders Grimtome's synthetic tooltip fixtures to PNG with Playwright.
 *
 * The images imitate the *layout* of Diablo IV item tooltips with original CSS
 * (no game assets), so they can be committed and used for OCR tests and as
 * in-app samples. Outputs:
 *   - public/samples/<id>.png + public/samples/index.json (sample gallery,
 *     with the source lines as the browser-preview "OCR" result)
 *   - tests/fixtures/tooltips/<id>.png (OCR test inputs)
 *
 * Usage: node scripts/render-tooltip-fixtures.ts
 */
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GARBLED,
  LEGENDARY_GLOVES_EARTHQUAKES,
  MYTHIC_HARLEQUIN,
  RARE_AMULET_ENDGAME,
  RARE_GLOVES_CRIT,
  RARE_RING_UNKNOWN,
  UNIQUE_MAGNUM_OPUS,
  type TooltipFixture,
} from '../tests/fixtures/tooltips.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const RARITY_COLOR: Record<string, string> = {
  rare: '#ffff64',
  legendary: '#f08a2c',
  unique: '#c7b377',
  mythic: '#b27dff',
  magic: '#6e91ff',
  common: '#e6e6e6',
};

const SAMPLES: { fixture: TooltipFixture; title: string; sample: boolean }[] = [
  { fixture: RARE_GLOVES_CRIT, title: 'Rare gloves', sample: true },
  { fixture: LEGENDARY_GLOVES_EARTHQUAKES, title: 'Legendary gloves', sample: true },
  { fixture: UNIQUE_MAGNUM_OPUS, title: 'Unique mace', sample: true },
  { fixture: MYTHIC_HARLEQUIN, title: 'Mythic helm', sample: true },
  { fixture: RARE_AMULET_ENDGAME, title: 'Rare amulet', sample: true },
  { fixture: RARE_RING_UNKNOWN, title: 'Rare ring', sample: true },
  { fixture: GARBLED, title: 'Unreadable', sample: false },
];

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function html(f: TooltipFixture): string {
  const [name, type, ...rest] = f.lines;
  const rarityWord =
    (type ?? '').toLowerCase().match(/mythic|unique|legendary|rare|magic|common/)?.[0] ?? 'common';
  const color = RARITY_COLOR[rarityWord] ?? '#e6e6e6';
  const body = rest
    .map((line) => {
      const bullet = line.match(/^([◆★])\s*/);
      if (bullet) {
        const ga = bullet[1] === '★';
        return `<div class="affix"><span class="${ga ? 'star' : 'dia'}">${ga ? '✦' : ''}</span>${esc(line.slice(bullet[0].length))}</div>`;
      }
      if (/Item Power/.test(line)) return `<div class="ip">${esc(line)}</div>`;
      if (/^(Requires|Sell Value|Durability|Unique Equip|Empty Socket)/.test(line))
        return `<div class="foot">${esc(line)}</div>`;
      if (/Armor$|Damage Per Second/.test(line)) return `<div class="base">${esc(line)}</div>`;
      if (line.split(' ').length > 5) return `<div class="power" style="color:${color}">${esc(line)}</div>`;
      return `<div class="base">${esc(line)}</div>`;
    })
    .join('');
  return `<!doctype html><html><head><style>
    body{margin:0;background:#050404;font-family:'Segoe UI',Arial,sans-serif;}
    .tt{width:420px;margin:24px;background:linear-gradient(180deg,#141110,#0b0908);border:1px solid #3a3027;box-shadow:0 0 0 1px #000;color:#d9d4cc;font-size:16px;line-height:1.45}
    .hd{padding:14px 18px 12px;background:linear-gradient(180deg,${color}33,${color}0d 70%,transparent);border-top:2px solid ${color}aa}
    .nm{color:${color};font-size:21px;font-weight:600}
    .ty{color:${color}cc;font-size:15px}
    .bd{padding:6px 18px 16px}
    .ip{font-weight:600;color:#ece6dc;margin-bottom:2px}
    .base{color:#a9a196}
    .affix{display:flex;align-items:center;gap:9px;margin-top:3px}
    .dia{width:7px;height:7px;transform:rotate(45deg);background:#bcb5a8;flex:none;margin:0 4px}
    .star{color:#f0a028;font-size:15px;width:15px;flex:none;text-align:center}
    .power{font-style:italic;margin-top:10px}
    .foot{color:#857d71;font-size:14px;margin-top:6px}
  </style></head><body><div class="tt" id="tt"><div class="hd"><div class="nm">${esc(name ?? '')}</div><div class="ty">${esc(type ?? '')}</div></div><div class="bd">${body}</div></div></body></html>`;
}

async function main() {
  const samplesDir = path.join(root, 'public', 'samples');
  const testsDir = path.join(root, 'tests', 'fixtures', 'tooltips');
  mkdirSync(samplesDir, { recursive: true });
  mkdirSync(testsDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const index: unknown[] = [];
  for (const { fixture, title, sample } of SAMPLES) {
    await page.setContent(html(fixture));
    const png = await page.locator('#tt').screenshot({ type: 'png' });
    writeFileSync(path.join(testsDir, `${fixture.id}.png`), png);
    if (sample) {
      writeFileSync(path.join(samplesDir, `${fixture.id}.png`), png);
      index.push({
        id: fixture.id,
        title,
        image: `samples/${fixture.id}.png`,
        sha256: createHash('sha256').update(png).digest('hex'),
        ocr: {
          engine: 'fixture',
          lines: fixture.lines.map((text, i) => ({ text, ...(fixture.colors?.[i] ?? {}) })),
        },
      });
    }
    console.log(`rendered ${fixture.id}`);
  }
  writeFileSync(path.join(samplesDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  await browser.close();
}

await main();
