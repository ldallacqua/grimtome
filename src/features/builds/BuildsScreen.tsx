import clsx from 'clsx';
import { useState } from 'react';
import { readiness, useApp } from '@/app/store';
import type { Build, GearPlan } from '@/domain/builds/schema';
import { CLASS_NAMES, SLOT_NAMES, SLOTS, type BuildRole } from '@/domain/shared/ids';
import { Badge, Button, Callout, ClassEmblem, Dialog, EmptyState, Icon, PageHeader, Panel, Stepper, Toggle } from '@/design-system';
import { exportJson } from '@/services/importers/json';
import { platform } from '@/services/platform';
import { ImportDialog } from './ImportDialog';
import './builds.css';

const SOURCE_LABEL: Record<Build['source']['kind'], string> = {
  sample: 'Sample',
  json: 'JSON import',
  manual: 'Manual',
  paste: 'Pasted guide',
  'maxroll-link': 'From Maxroll (pasted)',
};

function BuildSlot({ role, onImport }: { role: BuildRole; onImport: (r: BuildRole) => void }) {
  const build = useApp((s) => s.builds[role]);
  const phase = useApp((s) => s.transition.phase);
  const remove = useApp((s) => s.removeBuild);
  const [confirm, setConfirm] = useState(false);
  const label = role === 'leveling' ? 'Leveling build' : 'Endgame build';
  if (!build) {
    return (
      <Panel variant="raised" eyebrow={label} className="gt-buildslot is-empty">
        <EmptyState compact icon="builds" title={`No ${role} build`} body={role === 'leveling' ? 'The build you play while leveling.' : 'The build you are working toward.'} actions={<Button variant="primary" icon="plus" onClick={() => onImport(role)}>Import</Button>} />
      </Panel>
    );
  }
  const aspects = build.gear.filter((g) => g.aspect).length;
  const uniques = build.gear.filter((g) => g.unique).length;
  return (
    <Panel variant="raised" className={clsx('gt-buildslot', phase === role && 'is-active')}>
      <div className="gt-buildslot__head">
        <ClassEmblem classId={build.classId} size={72} />
        <div className="gt-buildslot__titles">
          <div className="gt-row">
            <span className="gt-section-label">{label}</span>
            {phase === role ? <Badge tone="success">Active</Badge> : null}
          </div>
          <h2 className="gt-buildslot__name">{build.name}</h2>
          <div className="gt-muted gt-small">
            {CLASS_NAMES[build.classId]}
            {build.season ? ` · ${build.season}` : ''}
            {build.patch ? ` · Patch ${build.patch}` : ''}
          </div>
        </div>
      </div>
      {build.summary ? <p className="gt-buildslot__summary">{build.summary}</p> : null}
      <div className="gt-buildslot__stats">
        <div>
          <span className="gt-num">{build.skills.length}</span>skill points
        </div>
        <div>
          <span className="gt-num">{aspects}</span>aspects
        </div>
        <div>
          <span className="gt-num">{uniques}</span>uniques
        </div>
        <div>
          <span className="gt-num">{build.paragon.length}</span>boards
        </div>
      </div>
      <div className="gt-buildslot__source">
        <Badge tone={build.source.kind === 'sample' ? 'arcane' : 'neutral'} icon={build.source.kind === 'sample' ? 'sparkle' : 'link'}>
          {SOURCE_LABEL[build.source.kind]}
        </Badge>
        <span className="gt-muted gt-small">{build.source.attribution}</span>
      </div>
      <div className="gt-row gt-row--wrap">
        <Button size="sm" variant="secondary" icon="refresh" onClick={() => onImport(role)}>
          Replace
        </Button>
        {build.source.url ? (
          <Button size="sm" variant="ghost" icon="external" onClick={() => void platform.openExternal(build.source.url!)}>
            Open source
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" icon="trash" onClick={() => setConfirm(true)}>
          Remove
        </Button>
      </div>
      <Dialog
        open={confirm}
        tone="danger"
        title={`Remove ${build.name}?`}
        onClose={() => setConfirm(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                remove(role);
                setConfirm(false);
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        Your progress for this build is kept, but item verdicts will no longer consider it.
      </Dialog>
    </Panel>
  );
}

function TransitionPanel() {
  const builds = useApp((s) => s.builds);
  const progress = useApp((s) => s.progress);
  const t = useApp((s) => s.transition);
  const toggleOwned = useApp((s) => s.toggleOwned);
  const toggleCustom = useApp((s) => s.toggleCustomCriterion);
  const setLevel = useApp((s) => s.setLevel);
  const setParagon = useApp((s) => s.setParagon);
  const accept = useApp((s) => s.acceptTransition);
  const postpone = useApp((s) => s.postponeTransition);
  const revert = useApp((s) => s.revertTransition);
  const toast = useApp((s) => s.toast);
  const [confirm, setConfirm] = useState<'accept' | 'revert' | null>(null);
  const r = readiness({ builds, progress });
  if (r.status === 'unavailable') return null;
  const onEndgame = t.phase === 'endgame';
  return (
    <Panel variant="ornate" padding="lg" eyebrow="Build transition" title={onEndgame ? `Playing ${builds.endgame?.name}` : `Transition to ${builds.endgame?.name}`}>
      <div className="gt-transition">
        <div className="gt-transition__criteria">
          <div className="gt-transition__char">
            <div>
              <div className="gt-section-label">Level</div>
              <Stepper value={progress.level} min={1} max={70} onChange={setLevel} label="Character level" />
            </div>
            <div>
              <div className="gt-section-label">Paragon</div>
              <Stepper value={progress.paragon} min={0} max={300} onChange={setParagon} label="Paragon level" />
            </div>
          </div>
          <ul className="gt-criteria">
            {r.criteria.map((c) => (
              <li key={c.id} className={clsx(c.met && 'is-met')}>
                <span className="gt-criteria__icon">
                  <Icon name={c.met ? 'check' : c.required ? 'lock' : 'info'} size={14} strokeWidth={2} />
                </span>
                <span className="gt-criteria__text">
                  <span>{c.label}</span>
                  <span className="gt-muted gt-small">
                    {c.detail}
                    {!c.required ? ' · advisory' : ''}
                  </span>
                </span>
                {c.kind === 'unique' || c.kind === 'aspect' ? (
                  <Toggle label={`${c.label} obtained`} checked={c.met} onChange={(v) => toggleOwned(c.kind as 'unique' | 'aspect', c.label.replace(/^Obtain /, ''), v)} />
                ) : c.kind === 'custom' ? (
                  <Toggle label={c.label} checked={c.met} onChange={() => toggleCustom(c.label)} />
                ) : null}
              </li>
            ))}
            {!r.criteria.length ? <li className="gt-muted">This endgame build lists no transition requirements.</li> : null}
          </ul>
        </div>
        <div className="gt-transition__status">
          {onEndgame ? (
            <Callout tone="success" title="Endgame build active">
              Item verdicts, skill guidance and Paragon goals now follow {builds.endgame?.name}.
            </Callout>
          ) : r.status === 'ready' ? (
            <Callout tone="arcane" title="Endgame transition available">
              Your character has reached the recommended progression stage. You can now switch to your planned endgame build.
            </Callout>
          ) : (
            <Callout tone="warning" title={`${r.missing.filter((m) => m.required).length} requirement(s) remaining`}>
              {r.missing
                .filter((m) => m.required)
                .map((m) => m.label)
                .join(' · ')}
            </Callout>
          )}
          <div className="gt-row gt-row--wrap" style={{ marginTop: 16 }}>
            {onEndgame ? (
              <Button variant="secondary" icon="swap" onClick={() => setConfirm('revert')}>
                Return to leveling build
              </Button>
            ) : (
              <>
                <Button variant="arcane" icon="flag" onClick={() => setConfirm('accept')}>
                  Switch to endgame
                </Button>
                {r.status === 'ready' ? (
                  <Button
                    variant="ghost"
                    icon="history"
                    onClick={() => {
                      postpone(progress.paragon + 10);
                      toast({ tone: 'info', title: 'Transition postponed', body: `We will remind you again at Paragon ${progress.paragon + 10}.` });
                    }}
                  >
                    Postpone
                  </Button>
                ) : null}
              </>
            )}
          </div>
          {t.history.length ? (
            <div className="gt-muted gt-small" style={{ marginTop: 12 }}>
              Last change: {t.history.at(-1)!.kind} on {new Date(t.history.at(-1)!.at).toLocaleString()}
            </div>
          ) : null}
        </div>
      </div>
      <Dialog
        open={confirm !== null}
        title={confirm === 'accept' ? 'Switch to your endgame build?' : 'Return to your leveling build?'}
        onClose={() => setConfirm(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={confirm === 'accept' ? 'arcane' : 'secondary'}
              icon={confirm === 'accept' ? 'flag' : 'swap'}
              onClick={() => {
                if (confirm === 'accept') accept();
                else revert();
                setConfirm(null);
                toast({ tone: 'success', title: confirm === 'accept' ? 'Endgame build active' : 'Leveling build active', body: 'Recommendations were updated.' });
              }}
            >
              {confirm === 'accept' ? 'Switch now' : 'Return'}
            </Button>
          </>
        }
      >
        {confirm === 'accept' ? (
          r.status === 'ready' ? (
            'All required criteria are met. Item verdicts, skill guidance and Paragon goals will follow the endgame build.'
          ) : (
            <>
              Some requirements are still missing ({r.missing.filter((m) => m.required).map((m) => m.label).join(', ')}). You can switch anyway — you can always
              return.
            </>
          )
        ) : (
          'Verdicts will again consider both builds, with the endgame build as the future target.'
        )}
      </Dialog>
    </Panel>
  );
}

function slotSummary(plan: GearPlan | undefined) {
  if (!plan) return <span className="gt-muted">—</span>;
  return (
    <div className="gt-compare__cell">
      {plan.unique ? (
        <div className="gt-compare__power is-unique">
          <Icon name="crown" size={13} />
          {plan.unique.name}
          {plan.unique.required ? <Badge tone="gold">core</Badge> : null}
        </div>
      ) : null}
      {plan.aspect ? (
        <div className="gt-compare__power">
          <Icon name="gem" size={13} />
          {plan.aspect.name}
        </div>
      ) : null}
      <div className="gt-compare__affixes">
        {plan.affixes.map((a) => (
          <span key={a.key} className={clsx('gt-compare__affix', `w${a.weight}`)}>
            {a.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Comparison() {
  const builds = useApp((s) => s.builds);
  if (!builds.leveling || !builds.endgame) return null;
  const pick = (b: Build, slot: string) => b.gear.filter((g) => g.slot === slot);
  return (
    <Panel title="Leveling vs endgame priorities" eyebrow="Comparison" padding="none">
      <div className="gt-compare" role="table">
        <div className="gt-compare__row gt-compare__row--head" role="row">
          <div role="columnheader">Slot</div>
          <div role="columnheader">{builds.leveling.name}</div>
          <div role="columnheader">{builds.endgame.name}</div>
        </div>
        {SLOTS.map((slot) => {
          const l = pick(builds.leveling!, slot);
          const e = pick(builds.endgame!, slot);
          if (!l.length && !e.length) return null;
          const rows = Math.max(l.length, e.length, 1);
          return Array.from({ length: rows }, (_, i) => {
            const changed = JSON.stringify(l[i]?.affixes.map((a) => a.key)) !== JSON.stringify(e[i]?.affixes.map((a) => a.key)) || l[i]?.aspect?.name !== e[i]?.aspect?.name;
            return (
              <div key={`${slot}-${i}`} className={clsx('gt-compare__row', changed && 'is-changed')} role="row">
                <div className="gt-compare__slot" role="cell">
                  <Icon name={slot} size={16} />
                  {SLOT_NAMES[slot]}
                  {rows > 1 ? ` ${i + 1}` : ''}
                </div>
                <div role="cell">{slotSummary(l[i])}</div>
                <div role="cell">{slotSummary(e[i])}</div>
              </div>
            );
          });
        })}
      </div>
    </Panel>
  );
}

export function BuildsScreen() {
  const builds = useApp((s) => s.builds);
  const loadSamples = useApp((s) => s.loadSampleBuilds);
  const [importRole, setImportRole] = useState<BuildRole | null>(null);
  const exportBuilds = () => {
    const blob = new Blob([exportJson(builds)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'grimtome-builds.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div>
      <PageHeader
        eyebrow="Builds"
        title="Your two builds"
        subtitle="Grimtome follows a leveling build now and an endgame build you are working toward, and tells you when to switch."
        actions={
          <>
            <Button variant="primary" icon="plus" onClick={() => setImportRole('leveling')}>
              Import
            </Button>
            <Button variant="secondary" icon="download" onClick={exportBuilds} disabled={!builds.leveling && !builds.endgame}>
              Export JSON
            </Button>
            <Button variant="ghost" icon="sparkle" onClick={loadSamples}>
              Load samples
            </Button>
          </>
        }
      />
      <div className="gt-stack">
        <div className="gt-grid gt-grid--2">
          <BuildSlot role="leveling" onImport={setImportRole} />
          <BuildSlot role="endgame" onImport={setImportRole} />
        </div>
        <TransitionPanel />
        <Comparison />
        <Callout tone="info" icon="link" title="Where builds come from">
          Grimtome never downloads guides from websites. Paste the sections you need from the guide you are reading, import a JSON file, or start from the
          samples — and the source link stays attached to your build.
        </Callout>
      </div>
      <ImportDialog open={importRole !== null} initialRole={importRole ?? 'leveling'} onClose={() => setImportRole(null)} key={importRole ?? 'none'} />
    </div>
  );
}
