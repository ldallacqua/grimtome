import clsx from 'clsx';
import { useState } from 'react';
import { useApp } from '@/app/store';
import { paragonMilestones, paragonProgress } from '@/domain/progression/paragon';
import { MAX_PARAGON_LEVEL, type BuildRole } from '@/domain/shared/ids';
import { Badge, Button, Callout, EmptyState, GlyphIcon, Icon, PageHeader, Panel, Ring, Stepper } from '@/design-system';
import { RoleSwitch } from '../skills/SkillsScreen';
import './paragon.css';

export function ParagonScreen() {
  const phase = useApp((s) => s.transition.phase);
  const [role, setRole] = useState<BuildRole>(phase);
  const builds = useApp((s) => s.builds);
  const build = builds[role] ?? builds[phase];
  const effectiveRole = build?.role ?? role;
  const completed = useApp((s) => s.progress.paragonCompleted[effectiveRole]);
  const paragon = useApp((s) => s.progress.paragon);
  const setParagon = useApp((s) => s.setParagon);
  const toggle = useApp((s) => s.toggleParagonStep);
  const navigate = useApp((s) => s.navigate);

  if (!build) {
    return (
      <div>
        <PageHeader eyebrow="Paragon" title="Paragon progression" />
        <Panel variant="ornate" padding="lg">
          <EmptyState icon="paragon" title="No build loaded" body="Import a build to track its Paragon boards and glyphs." actions={<Button variant="primary" icon="builds" onClick={() => navigate('builds')}>Manage builds</Button>} />
        </Panel>
      </div>
    );
  }
  const milestones = paragonMilestones(build, completed);
  const prog = paragonProgress(build, completed);

  return (
    <div>
      <PageHeader
        eyebrow="Paragon"
        title="Paragon progression"
        subtitle={`Board order and glyphs from ${build.name}. Check off each milestone as you complete it.`}
        actions={<RoleSwitch value={effectiveRole} onChange={setRole} />}
      />
      <div className="gt-grid gt-grid--sidebar">
        <Panel variant="ornate" padding="lg" title="Board path" eyebrow={`${prog.done} of ${prog.total} milestones`}>
          {milestones.length ? (
            <ol className="gt-paragon-path">
              {milestones.map((m) => (
                <li key={m.id} className={clsx('gt-board', m.completed && 'is-done', m.current && 'is-current')}>
                  <div className="gt-board__node" aria-hidden>
                    <span className="gt-num">{m.order}</span>
                  </div>
                  <div className="gt-board__card">
                    <div className="gt-board__head">
                      <div>
                        <div className="gt-board__name">{m.board.name}</div>
                        <div className="gt-row gt-row--wrap" style={{ marginTop: 6 }}>
                          {m.current ? <Badge tone="gold" icon="target">Current objective</Badge> : null}
                          {m.completed ? <Badge tone="success" icon="check">Completed</Badge> : null}
                          {m.targetParagon !== undefined ? <Badge>Paragon {m.targetParagon}</Badge> : null}
                        </div>
                      </div>
                      <Button size="sm" variant={m.completed ? 'ghost' : 'secondary'} icon={m.completed ? 'refresh' : 'check'} onClick={() => toggle(effectiveRole, m.id)}>
                        {m.completed ? 'Undo' : 'Complete'}
                      </Button>
                    </div>
                    {m.glyph ? (
                      <div className="gt-board__glyph">
                        <GlyphIcon id={m.glyph.id ?? null} name={m.glyph.name} size={42} />
                        <div>
                          <div className="gt-section-label">Glyph</div>
                          <div className="gt-board__glyphname">{m.glyph.name}</div>
                        </div>
                      </div>
                    ) : null}
                    {m.focus ? <p className="gt-board__focus">{m.focus}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState compact icon="paragon" title="No Paragon plan" body="This build source did not include Paragon boards." />
          )}
        </Panel>
        <div className="gt-stack">
          <Panel title="Your Paragon level" eyebrow="Character">
            <div className="gt-paragon-level">
              <Ring value={paragon} max={MAX_PARAGON_LEVEL} size={96}>
                <div className="gt-num gt-paragon-level__value">{paragon}</div>
                <div className="gt-paragon-level__label">/ {MAX_PARAGON_LEVEL}</div>
              </Ring>
              <Stepper value={paragon} min={0} max={MAX_PARAGON_LEVEL} onChange={setParagon} label="Paragon level" />
            </div>
          </Panel>
          <Callout tone="info" icon="info" title="Milestone tracking">
            Node-by-node routes are shown only when a build source provides node data. Imported guides usually list boards and glyphs, so Grimtome tracks
            those milestones rather than inventing paths.
          </Callout>
          <Panel title="Glyphs in this plan" eyebrow="Collection" padding="sm">
            <div className="gt-glyph-list">
              {milestones
                .filter((m) => m.glyph)
                .map((m) => (
                  <div key={m.id} className={clsx('gt-glyph-row', m.completed && 'is-done')}>
                    <GlyphIcon id={m.glyph!.id ?? null} name={m.glyph!.name} size={30} />
                    <span>{m.glyph!.name}</span>
                    {m.completed ? <Icon name="check" size={14} /> : null}
                  </div>
                ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
