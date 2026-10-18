import clsx from 'clsx';
import { useState } from 'react';
import { useApp } from '@/app/store';
import type { BuildRole } from '@/domain/shared/ids';
import { nextSkillPoint, stepLabel, summarizeSkills } from '@/domain/progression/skills';
import { Badge, Button, EmptyState, Icon, Meter, PageHeader, Panel, Segmented, SkillIcon } from '@/design-system';
import './skills.css';

export function RoleSwitch({ value, onChange }: { value: BuildRole; onChange: (r: BuildRole) => void }) {
  const builds = useApp((s) => s.builds);
  const phase = useApp((s) => s.transition.phase);
  const label = (r: BuildRole) => `${r === 'leveling' ? 'Leveling' : 'Endgame'}${phase === r ? ' · active' : ''}`;
  return (
    <Segmented
      label="Build"
      value={value}
      onChange={onChange}
      options={(['leveling', 'endgame'] as const).filter((r) => builds[r]).map((r) => ({ value: r, label: label(r) }))}
    />
  );
}

function Pips({ rank, planned, max }: { rank: number; planned: number; max?: number }) {
  const total = Math.max(planned, max ?? planned);
  return (
    <span className="gt-pips" aria-label={`Rank ${rank} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={clsx(i < rank ? 'is-on' : i < planned ? 'is-planned' : 'is-off')} />
      ))}
    </span>
  );
}

export function SkillsScreen() {
  const phase = useApp((s) => s.transition.phase);
  const [role, setRole] = useState<BuildRole>(phase);
  const builds = useApp((s) => s.builds);
  const build = builds[role] ?? builds[phase];
  const effectiveRole = build?.role ?? role;
  const allocated = useApp((s) => s.progress.skillSteps[effectiveRole]);
  const setSteps = useApp((s) => s.setSkillSteps);
  const catalog = useApp((s) => s.catalog);
  const navigate = useApp((s) => s.navigate);

  if (!build) {
    return (
      <div>
        <PageHeader eyebrow="Skills" title="Skill progression" />
        <Panel variant="ornate" padding="lg">
          <EmptyState icon="skills" title="No build loaded" body="Import a build to follow its skill point plan." actions={<Button variant="primary" icon="builds" onClick={() => navigate('builds')}>Manage builds</Button>} />
        </Panel>
      </div>
    );
  }
  const next = nextSkillPoint(build, allocated);
  const summary = summarizeSkills(build, allocated);
  const catalogSkill = (id?: string) => (id ? catalog?.skills.find((s) => s.id === id) : undefined);

  return (
    <div>
      <PageHeader
        eyebrow="Skills"
        title="Skill progression"
        subtitle={`Follow the skill point order from ${build.name}. Mark points as you spend them in game.`}
        actions={<RoleSwitch value={effectiveRole} onChange={setRole} />}
      />
      <div className="gt-stack">
        <Panel variant="ornate" padding="lg" className="gt-next-skill">
          {next ? (
            <div className="gt-next-skill__grid">
              <SkillIcon id={next.step.skill.id ?? null} name={next.step.skill.name} size={104} state="next" />
              <div className="gt-next-skill__text">
                <div className="gt-section-label">Next skill point</div>
                <h2 className="gt-next-skill__title">
                  Invest your next point into <span>{next.step.skill.name}</span>
                </h2>
                <div className="gt-row gt-row--wrap">
                  <Badge tone="gold" icon={next.step.kind === 'upgrade' ? 'sparkle' : 'plus'}>
                    {next.label}
                  </Badge>
                  <span className="gt-muted gt-small">Recommended next step in the imported {build.role} build.</span>
                </div>
                {catalogSkill(next.step.skill.id)?.summary ? <p className="gt-next-skill__desc">{catalogSkill(next.step.skill.id)!.summary}</p> : null}
                <div className="gt-next-skill__progress">
                  <Meter value={allocated} max={build.skills.length} label="Skill points allocated" />
                  <span className="gt-num gt-muted gt-small">
                    {allocated} / {build.skills.length} points
                  </span>
                </div>
              </div>
              <div className="gt-next-skill__actions">
                <Button variant="primary" icon="check" size="lg" onClick={() => setSteps(effectiveRole, allocated + 1)}>
                  Mark allocated
                </Button>
                <Button variant="ghost" icon="chevronLeft" onClick={() => setSteps(effectiveRole, allocated - 1)} disabled={allocated === 0}>
                  Undo last
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState icon="check" title="Skill plan complete" body={`All ${build.skills.length} listed points are allocated.`} actions={<Button variant="ghost" onClick={() => setSteps(effectiveRole, 0)}>Reset progress</Button>} compact />
          )}
        </Panel>

        <div className="gt-grid gt-grid--sidebar">
          <Panel title="Skills in this build" eyebrow={`${summary.length} skills`}>
            <div className="gt-skill-grid">
              {summary.map((s) => {
                const cs = catalogSkill(s.id);
                return (
                  <div key={s.name} className={clsx('gt-skill-card gt-card', s.rank >= s.plannedRank && s.plannedRank > 0 && 'is-complete')}>
                    <SkillIcon id={s.id ?? null} name={s.name} size={56} state={s.rank > 0 ? 'learned' : 'locked'} />
                    <div className="gt-skill-card__text">
                      <div className="gt-skill-card__name">{s.name}</div>
                      {s.plannedRank ? <Pips rank={s.rank} planned={s.plannedRank} {...(s.maxRank ? { max: s.maxRank } : {})} /> : null}
                      {s.upgradesPlanned.length ? (
                        <ul className="gt-skill-card__upgrades">
                          {s.upgradesPlanned.map((u) => (
                            <li key={u} className={clsx(s.upgradesTaken.includes(u) && 'is-taken')}>
                              <Icon name={s.upgradesTaken.includes(u) ? 'check' : 'sparkle'} size={12} />
                              {u}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {cs?.summary ? <p className="gt-skill-card__desc">{cs.summary}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
          <Panel title="Allocation order" eyebrow="Click a step to set your progress" padding="sm">
            <ol className="gt-plan">
              {build.skills.map((step, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className={clsx('gt-plan__step gt-card', i < allocated && 'is-done', i === allocated && 'is-next')}
                    onClick={() => setSteps(effectiveRole, i + 1)}
                    title="Mark everything up to this step as allocated"
                  >
                    <span className="gt-plan__num gt-num">{i + 1}</span>
                    <SkillIcon id={step.skill.id ?? null} name={step.skill.name} size={28} state={i < allocated ? 'learned' : 'idle'} />
                    <span className="gt-plan__text">
                      <span className="gt-plan__name">{step.skill.name}</span>
                      <span className="gt-plan__label">{stepLabel(step)}</span>
                    </span>
                    {i < allocated ? <Icon name="check" size={14} className="gt-plan__check" /> : null}
                  </button>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}
