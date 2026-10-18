import clsx from 'clsx';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hotkeyParts } from '@/app/settings';
import { refreshAssets } from '@/app/assets';
import { useApp } from '@/app/store';
import { SAMPLE_BUILDS } from '@/domain/builds/samples';
import { parseTooltip } from '@/domain/items/parser';
import { evaluateItem } from '@/domain/recommendations/engine';
import type { Verdict } from '@/domain/recommendations/types';
import { BrandMark, Icon, IconButton, KeyCap, useGameSkin, VERDICT_META, VerdictIcon } from '@/design-system';
import { isTauri, platform, type OverlayMessage } from '@/services/platform';
import './overlay.css';

/** Browser preview / visual-test content: a real evaluation of a sample item. */
function demoMessage(): OverlayMessage {
  const item = parseTooltip([
    'Gauntlets of Earthquakes',
    'Ancestral Legendary Gloves',
    '800 Item Power',
    '★ +14.0% Critical Strike Chance',
    '◆ +5.5% Movement Speed',
    '◆ +120 Maximum Life',
    'Ground Stomp and Leap leave behind tremors that deal damage over time.',
  ]);
  const ev = evaluateItem(item, { builds: SAMPLE_BUILDS, activeRole: 'leveling' });
  return {
    kind: 'evaluation',
    verdict: ev.verdict,
    headline: ev.headline,
    summary: ev.summary,
    itemName: item.name,
    rarity: item.rarity,
    slot: item.slot,
    reasons: ev.reasons.map((r) => ({ tone: r.tone, text: r.text, ...(r.role ? { role: r.role } : {}) })),
    confidence: ev.confidence,
    activeBuild: SAMPLE_BUILDS.leveling.name,
    iconUrl: null,
    at: new Date().toISOString(),
  };
}

export function OverlayApp() {
  const [message, setMessage] = useState<OverlayMessage | null>(() =>
    !isTauri && new URLSearchParams(window.location.search).has('demo') ? demoMessage() : null,
  );
  const [expandedOverride, setExpanded] = useState<boolean | null>(null);
  const [visible, setVisible] = useState(true);
  const settings = useApp((s) => s.settings);
  const resolver = useApp((s) => s.resolver);
  const expanded = expandedOverride ?? settings.overlay.mode === 'expanded';
  useGameSkin(resolver, settings.assets.useGameAssets && resolver.hasGameAssets);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void useApp.getState().hydrate();
    void refreshAssets();
    return platform.windows.onOverlayMessage((m) => {
      void useApp.getState().hydrate();
      setMessage(m);
      setVisible(true);
    });
  }, []);

  useEffect(() => {
    if (!message || !settings.overlay.autoHideSeconds) return;
    const t = setTimeout(() => setVisible(false), settings.overlay.autoHideSeconds * 1000);
    return () => clearTimeout(t);
  }, [message, settings.overlay.autoHideSeconds]);

  // Keep the native window exactly as large as the card so no invisible area blocks the game.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      void platform.windows.fitCurrent(r.width + 2, r.height + 2);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const verdict = (message?.verdict ?? null) as Verdict | null;
  const meta = verdict ? VERDICT_META[verdict] : null;

  return (
    <div className="gt-ov" style={{ opacity: visible ? settings.overlay.opacity : 0 }}>
      <div
        ref={cardRef}
        className={clsx('gt-ov__card', expanded && 'is-expanded')}
        data-verdict={verdict ?? undefined}
      >
        <div className="gt-ov__bar" data-tauri-drag-region>
          <BrandMark size={16} glow={false} />
          <span className="gt-ov__build" data-tauri-drag-region>
            {message?.activeBuild ?? 'Grimtome'}
          </span>
          <IconButton
            icon={expanded ? 'minus' : 'plus'}
            label={expanded ? 'Compact' : 'Expand'}
            size="sm"
            onClick={() => setExpanded(!expanded)}
          />
          <IconButton
            icon="close"
            label="Hide overlay"
            size="sm"
            onClick={() => void platform.windows.hideCurrent()}
          />
        </div>
        {message && meta ? (
          <div className="gt-ov__body">
            <div className="gt-ov__verdict">
              <span className="gt-ov__sigil">
                <VerdictIcon verdict={verdict!} size={18} />
              </span>
              <div className="gt-ov__vtext">
                <div className="gt-ov__vlabel">{meta.label}</div>
                <div className="gt-ov__item" data-rarity={message.rarity ?? 'common'}>
                  {message.iconUrl ? <img src={message.iconUrl} alt="" /> : null}
                  {message.itemName ?? 'Unknown item'}
                </div>
              </div>
            </div>
            <p className="gt-ov__summary">{message.summary}</p>
            {expanded ? (
              <ul className="gt-ov__reasons">
                {message.reasons.map((r, i) => (
                  <li key={i} className={`is-${r.tone}`}>
                    <Icon
                      name={
                        r.tone === 'positive'
                          ? 'check'
                          : r.tone === 'warning'
                            ? 'warning'
                            : r.tone === 'negative'
                              ? 'minus'
                              : 'info'
                      }
                      size={12}
                      strokeWidth={2.2}
                    />
                    <span>{r.text}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {message.confidence !== 'high' ? (
              <div className="gt-ov__conf">
                <Icon name="warning" size={12} /> {message.confidence === 'low' ? 'Low' : 'Medium'} confidence
                — review in Grimtome
              </div>
            ) : null}
          </div>
        ) : (
          <div className="gt-ov__idle">
            Hover an item and press <KeyCap keys={hotkeyParts(settings.hotkeys.scan)} size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}
