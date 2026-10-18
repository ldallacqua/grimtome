import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { evaluate, useApp, useEvalState } from '@/app/store';
import { useScanController } from '@/app/useScan';
import type { ParsedItem } from '@/domain/items/types';
import { SLOT_NAMES } from '@/domain/shared/ids';
import type { BuildRole } from '@/domain/shared/ids';
import {
  Button,
  Callout,
  Confidence,
  EmptyState,
  IconButton,
  ItemCard,
  ItemIcon,
  PageHeader,
  Panel,
  VerdictBadge,
  VerdictBanner,
  type AffixAnnotation,
} from '@/design-system';
import { platform } from '@/services/platform';
import { timeAgo } from '@/shared/format';
import { FitCard, ReasonList } from './AdvisorParts';
import { CorrectionEditor } from './CorrectionEditor';
import { DropZone, SampleGallery, useFileScan, usePasteDialog } from './ScanInput';
import './advisor.css';

function annotationsFor(item: ParsedItem, ev: ReturnType<typeof evaluate>, activeRole: BuildRole): Record<number, AffixAnnotation> {
  const out: Record<number, AffixAnnotation> = {};
  const futureRole: BuildRole = activeRole === 'leveling' ? 'endgame' : 'leveling';
  item.affixes.forEach((a, i) => {
    if (!a.key) return;
    const act = ev.fits[activeRole]?.matched.find((m) => m.key === a.key);
    const fut = activeRole === 'leveling' ? ev.fits[futureRole]?.matched.find((m) => m.key === a.key) : undefined;
    if (act || fut) out[i] = { ...(act ? { active: act.weight } : {}), ...(fut ? { future: fut.weight } : {}) };
  });
  return out;
}

function HistoryStrip() {
  const scans = useApp((s) => s.scans);
  const selected = useApp((s) => s.selectedScanId);
  const select = useApp((s) => s.selectScan);
  const remove = useApp((s) => s.removeScan);
  const clear = useApp((s) => s.clearScans);
  const ctx = useEvalState();
  if (!scans.length) return null;
  const current = selected ?? scans[0]?.id;
  return (
    <div className="gt-strip" aria-label="Scan history">
      <div className="gt-strip__label">
        <span className="gt-section-label">History</span>
        <IconButton icon="trash" label="Clear history" size="sm" onClick={clear} />
      </div>
      <ul className="gt-strip__list">
        {scans.map((sc) => {
          const ev = evaluate(ctx, sc.item);
          return (
            <li key={sc.id} data-verdict={ev.verdict}>
              <button type="button" className={clsx('gt-strip__item', sc.id === current && 'is-selected')} onClick={() => select(sc.id)}>
                <ItemIcon slot={sc.item.slot} rarity={sc.item.rarity} size={34} />
                <span className="gt-strip__text">
                  <span className="gt-strip__name" data-rarity={sc.item.rarity ?? 'common'}>
                    {sc.item.name ?? 'Unknown item'}
                  </span>
                  <span className="gt-strip__meta">
                    <VerdictBadge verdict={ev.verdict} size="sm" short /> <span>{timeAgo(sc.at)}</span>
                  </span>
                </span>
              </button>
              <IconButton icon="close" label="Remove scan" size="sm" className="gt-strip__remove" onClick={() => remove(sc.id)} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Result() {
  const scans = useApp((s) => s.scans);
  const selectedId = useApp((s) => s.selectedScanId);
  const ctx = useEvalState();
  const activeRole = ctx.transition.phase;
  const updateScanItem = useApp((s) => s.updateScanItem);
  const setEquipped = useApp((s) => s.setEquipped);
  const toggleOwned = useApp((s) => s.toggleOwned);
  const progress = useApp((s) => s.progress);
  const toast = useApp((s) => s.toast);
  const catalog = useApp((s) => s.catalog);
  const [editing, setEditing] = useState(false);
  const [showOcr, setShowOcr] = useState(false);
  const scan = scans.find((s) => s.id === selectedId) ?? scans[0];
  const ev = useMemo(() => (scan ? evaluate(ctx, scan.item) : null), [ctx, scan]);
  if (!scan || !ev) return null;
  const item = scan.item;
  const iconId =
    catalog && item.name && (item.rarity === 'unique' || item.rarity === 'mythic')
      ? (catalog.uniques.find((u) => u.name.toLowerCase() === item.name!.toLowerCase())?.icon ?? null)
      : null;
  const fits = (['leveling', 'endgame'] as const).map((r) => ev.fits[r]).filter((f) => !!f);
  const ownedName = ev.fits.endgame?.unique?.name ?? ev.fits.leveling?.unique?.name ?? ev.fits.endgame?.aspect?.name ?? ev.fits.leveling?.aspect?.name;
  const ownedKind = ev.fits.endgame?.unique || ev.fits.leveling?.unique ? 'unique' : 'aspect';
  const owned = ownedName ? (ownedKind === 'unique' ? progress.ownedUniques : progress.ownedAspects).includes(ownedName.toLowerCase()) : false;

  return (
    <div className="gt-stack" data-testid="advisor-result">
      <VerdictBanner
        verdict={ev.verdict}
        headline={ev.headline}
        summary={ev.summary}
        aside={
          <>
            <Confidence level={ev.confidence} score={item.confidence.score} />
            {item.verified ? <span className="gt-muted gt-small">Reviewed by you</span> : null}
          </>
        }
      />
      <div className="gt-advisor-grid">
        <div className="gt-advisor-item">
          <ItemCard {...item} iconId={iconId} annotations={annotationsFor(item, ev, activeRole)} />
          <div className="gt-advisor-legend">
            <span>
              <i className="is-active" /> {activeRole === 'leveling' ? 'Leveling' : 'Endgame'} priority
            </span>
            {activeRole === 'leveling' ? (
              <span>
                <i className="is-future" /> Endgame priority
              </span>
            ) : null}
            <span>
              <i className="is-unknown" /> Not recognized
            </span>
          </div>
        </div>
        <div className="gt-stack">
          <Panel title="Why" eyebrow="Explanation" padding="md">
            <ReasonList reasons={ev.reasons} />
            {ev.caveats.length ? (
              <div style={{ marginTop: 14 }}>
                <Callout tone="warning" title="Worth double-checking">
                  <ul className="gt-caveats">
                    {ev.caveats.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </Callout>
              </div>
            ) : null}
          </Panel>
          <div className="gt-fits">
            {fits.map((f) => (
              <FitCard key={f.role} fit={f} active={f.role === activeRole} />
            ))}
          </div>
          <div className="gt-row gt-row--wrap">
            <Button size="sm" variant="secondary" icon="edit" onClick={() => setEditing((v) => !v)}>
              {editing ? 'Close editor' : 'Correct details'}
            </Button>
            {item.slot ? (
              <Button
                size="sm"
                variant="secondary"
                icon="keep"
                onClick={() => {
                  setEquipped(item.slot!, { ...item, equipped: true });
                  toast({ tone: 'success', title: 'Marked as equipped', body: `Future ${SLOT_NAMES[item.slot!].toLowerCase()} scans will be compared against it.` });
                }}
              >
                Mark as equipped
              </Button>
            ) : null}
            {ownedName ? (
              <Button size="sm" variant={owned ? 'ghost' : 'arcane'} icon={owned ? 'check' : 'stash'} onClick={() => toggleOwned(ownedKind, ownedName)}>
                {owned ? `${ownedName} obtained` : `I have ${ownedName}`}
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" icon="info" onClick={() => setShowOcr((v) => !v)}>
              {showOcr ? 'Hide' : 'Show'} recognized text
            </Button>
          </div>
        </div>
      </div>
      {editing ? (
        <Panel title="Review recognized details" eyebrow="Corrections" variant="raised">
          <CorrectionEditor
            item={item}
            onCancel={() => setEditing(false)}
            onSave={(next) => {
              updateScanItem(scan.id, next, true);
              setEditing(false);
              toast({ tone: 'success', title: 'Corrections saved', body: 'The verdict was recalculated with your changes.' });
            }}
          />
        </Panel>
      ) : null}
      {showOcr ? (
        <Panel title="Recognized text" eyebrow={`Source: ${scan.source}`} variant="inset">
          <div className="gt-ocr">
            {scan.image ? <img src={scan.image} alt="Captured tooltip" className="gt-ocr__image" /> : null}
            <pre className="gt-ocr__lines">{scan.lines.join('\n')}</pre>
          </div>
          {item.confidence.issues.length ? (
            <ul className="gt-caveats" style={{ marginTop: 12 }}>
              {item.confidence.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}

export function ItemAdvisorScreen() {
  const scans = useApp((s) => s.scans);
  const hasBuild = useApp((s) => !!s.builds[s.transition.phase]);
  const navigate = useApp((s) => s.navigate);
  const loadSamples = useApp((s) => s.loadSampleBuilds);
  const scanning = useApp((s) => s.scanning);
  const { scanNow } = useScanController();
  const file = useFileScan();
  const paste = usePasteDialog();
  const [showSamples, setShowSamples] = useState(false);
  return (
    <div>
      {file.input}
      {paste.dialog}
      <PageHeader
        eyebrow="Item Advisor"
        title="Know what to keep"
        subtitle="Every item is judged against your active build and the endgame build you are working toward — with the reasons spelled out."
        actions={
          scans.length ? (
            <>
              {platform.capture.available ? (
                <Button variant="primary" icon="scan" loading={scanning} onClick={() => void scanNow()}>
                  Scan
                </Button>
              ) : null}
              <Button variant="secondary" icon="upload" onClick={file.pick}>
                Upload
              </Button>
              <Button variant="secondary" icon="paste" onClick={paste.open}>
                Paste
              </Button>
              <Button variant={showSamples ? 'secondary' : 'ghost'} icon="sparkle" onClick={() => setShowSamples((v) => !v)}>
                Samples
              </Button>
            </>
          ) : null
        }
      />
      {!hasBuild ? (
        <div style={{ marginBottom: 20 }}>
          <Callout tone="arcane" title="No build loaded">
            Verdicts need a build to compare against.{' '}
            <a href="#" onClick={(e) => (e.preventDefault(), navigate('builds'))}>
              Import builds
            </a>{' '}
            or{' '}
            <a href="#" onClick={(e) => (e.preventDefault(), loadSamples())}>
              load the sample builds
            </a>
            .
          </Callout>
        </div>
      ) : null}
      {showSamples && scans.length ? (
        <Panel padding="md" variant="inset" className="gt-advisor-samples">
          <SampleGallery />
        </Panel>
      ) : null}
      {scans.length ? (
        <div className="gt-stack">
          <HistoryStrip />
          <Result />
        </div>
      ) : (
        <Panel variant="ornate" padding="lg">
          {hasBuild ? <DropZone /> : <EmptyState icon="advisor" title="Load a build to start" body="Then scan or upload an item." />}
        </Panel>
      )}
    </div>
  );
}
