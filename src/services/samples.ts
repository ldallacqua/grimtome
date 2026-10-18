import type { OcrResult } from '@/domain/items/types';

/**
 * Sample tooltips shipped with the app (original synthetic renders, see
 * `scripts/render-tooltip-fixtures.mjs`). They let people try the advisor
 * without the game, and drive the browser-preview OCR in tests.
 */
export interface SampleTooltip {
  id: string;
  title: string;
  image: string;
  sha256: string;
  ocr: OcrResult;
}

let cache: Promise<SampleTooltip[]> | null = null;

export function loadSamples(): Promise<SampleTooltip[]> {
  cache ??= fetch(`${import.meta.env.BASE_URL}samples/index.json`)
    .then((r) => (r.ok ? (r.json() as Promise<SampleTooltip[]>) : []))
    .catch(() => []);
  return cache;
}

export async function sampleBytes(sample: SampleTooltip): Promise<{ bytes: Uint8Array; dataUrl: string }> {
  const r = await fetch(`${import.meta.env.BASE_URL}${sample.image}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  return { bytes: buf, dataUrl: `${import.meta.env.BASE_URL}${sample.image}` };
}

export function readFileBytes(file: File): Promise<{ bytes: Uint8Array; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const b64 = dataUrl.split(',')[1] ?? '';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      resolve({ bytes, dataUrl });
    };
    reader.readAsDataURL(file);
  });
}
