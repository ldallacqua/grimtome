import { useCallback } from 'react';
import { parseTooltip } from '@/domain/items/parser';
import type { OcrResult, ParsedItem } from '@/domain/items/types';
import type { GameCatalog } from '@/services/assets/types';
import { isTauri, platform, type OverlayMessage, type ScanPayload } from '@/services/platform';
import type { ScanRecord } from './persistence';
import { evaluate, useApp } from './store';

/**
 * The single path every scan takes, regardless of where it came from
 * (global hotkey capture, screenshot upload, pasted text, sample tooltip):
 * OCR lines → parse → store → evaluate → notify overlay.
 */

/** Catalog icon id for a unique/mythic item, matched by its exact name. */
export function uniqueIconId(catalog: GameCatalog | null, item: Pick<ParsedItem, 'name' | 'rarity'>): string | null {
  if (!catalog || !item.name || (item.rarity !== 'unique' && item.rarity !== 'mythic')) return null;
  const n = item.name.toLowerCase();
  return catalog.uniques.find((u) => u.name.toLowerCase() === n)?.icon ?? null;
}

export function overlayMessageFor(record: ScanRecord): OverlayMessage {
  const s = useApp.getState();
  const ev = evaluate(s, record.item);
  const active = s.builds[s.transition.phase];
  const iconId = uniqueIconId(s.catalog, record.item);
  return {
    kind: 'evaluation',
    verdict: ev.verdict,
    headline: ev.headline,
    summary: ev.summary,
    itemName: record.item.name,
    rarity: record.item.rarity,
    slot: record.item.slot,
    reasons: ev.reasons.slice(0, 4).map((r) => ({ tone: r.tone, text: r.text, ...(r.role ? { role: r.role } : {}) })),
    confidence: ev.confidence,
    activeBuild: active?.name ?? null,
    iconUrl: iconId ? s.resolver.url(iconId) : null,
    at: record.at,
  };
}

export function ingestScan(
  input: { ocr: OcrResult; image?: string | null; equipped?: OcrResult | null },
  source: ScanRecord['source'],
  opts: { navigate?: boolean } = {},
): ScanRecord {
  const s = useApp.getState();
  const item = parseTooltip(input.ocr.lines, { dictionary: s.dictionary });
  if (input.equipped?.lines.length) {
    const eq = parseTooltip(input.equipped.lines, { dictionary: s.dictionary });
    if (eq.slot && eq.confidence.level !== 'low') s.setEquipped(eq.slot, { ...eq, equipped: true });
  }
  const record = s.addScan({
    source,
    item,
    lines: input.ocr.lines.map((l) => l.text),
    image: input.image ?? null,
  });
  if (opts.navigate !== false) s.navigate('advisor');
  const settings = useApp.getState().settings;
  if (isTauri && settings.overlay.enabled && settings.overlay.showOnScan) {
    void platform.windows.showOverlay(true).then(() => platform.windows.sendToOverlay(overlayMessageFor(record)));
  }
  return record;
}

export function useScanController() {
  const setScanning = useApp((st) => st.setScanning);
  const toast = useApp((st) => st.toast);
  const navigate = useApp((st) => st.navigate);

  const scanNow = useCallback(async () => {
    if (!platform.capture.available) {
      navigate('advisor');
      toast({
        tone: 'info',
        title: 'Screen capture needs the desktop app',
        body: 'In this preview, upload a screenshot or try a sample tooltip instead.',
      });
      return null;
    }
    setScanning(true);
    try {
      const payload: ScanPayload = await platform.capture.scan(useApp.getState().settings.capture);
      return ingestScan(payload, 'capture');
    } catch (e) {
      toast({ tone: 'danger', title: 'Scan failed', body: e instanceof Error ? e.message : String(e) });
      return null;
    } finally {
      setScanning(false);
    }
  }, [navigate, setScanning, toast]);

  const scanImage = useCallback(
    async (bytes: Uint8Array, source: ScanRecord['source'] = 'upload', dataUrl?: string) => {
      setScanning(true);
      try {
        const ocr = await platform.ocr.recognize(bytes);
        return ingestScan({ ocr, image: dataUrl ?? null }, source);
      } catch (e) {
        toast({ tone: 'warning', title: 'Could not read that image', body: e instanceof Error ? e.message : String(e) });
        return null;
      } finally {
        setScanning(false);
      }
    },
    [setScanning, toast],
  );

  const scanText = useCallback((text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((t) => ({ text: t }));
    if (!lines.length) return null;
    return ingestScan({ ocr: { lines, engine: 'manual' } }, 'paste');
  }, []);

  return { scanNow, scanImage, scanText };
}
