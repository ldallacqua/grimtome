// Renders the original Grimtome mark (assets/brand/grimtome-mark.svg) to a 1024px PNG
// for `tauri icon`, which then generates every Windows icon size.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(path.join(root, 'assets', 'brand', 'grimtome-mark.svg'), 'utf8');
mkdirSync(path.join(root, 'src-tauri', 'icons'), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
await page.locator('svg').screenshot({ path: path.join(root, 'src-tauri', 'icons', 'app-icon.png'), omitBackground: true });
await browser.close();
console.log('src-tauri/icons/app-icon.png');
