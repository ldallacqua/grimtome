import clsx from 'clsx';
import type { CSSProperties } from 'react';
import { hotkeyParts } from '@/app/settings';
import { evaluate, readiness, selectActiveBuild, useApp, useEvalState } from '@/app/store';
import { useScanController } from '@/app/useScan';
import { CLASS_NAMES, MAX_CHARACTER_LEVEL, MAX_PARAGON_LEVEL } from '@/domain/shared/ids';
import { currentParagonObjective, paragonProgress } from '@/domain/progression/paragon';
import { nextSkillPoint } from '@/domain/progression/skills';
import {
  Badge,
  Button,
  ClassEmblem,
  EmptyState,
  GlyphIcon,
  Icon,
  ItemIcon,
  KeyCap,
  Meter,
  Panel,
  Ring,
  SkillIcon,
  Stepper,
  VerdictBadge,
  useAssets,
} from '@/design-system';
import { timeAgo } from '@/shared/format';
import './dashboard.css';

const HERO_ART = ['art.loadingscreen-season15-07', 'art.loadingscreen-season15-06', 'art.loadingscreen-season15-08'];

function Hero() {
  const build = useApp(selectActiveBuild);
  const phase = useApp((s) => s.transition.phase);
  const progress = useApp((s) => s.progress);
  const setLevel = useApp((s) => s.setLevel);
  const setParagon = useApp((s) => s.setParagon);
  const { resolver, showArt } = useAssets();
  const art = showArt ? (HERO_ART.map((id) => resolver.url(id)).find(Boolean) ?? null) : null;
  const emblem = build && showArt ? resolver.url(`class.${build.classId}.emblem`) : null;
  return (
    <section className={clsx('gt-hero', art && 'has-art')} style={art ? ({ '--hero-art': `url("${art}")` } as CSSProperties) : undefined}>
      <div className="gt-hero__veil" aria-hidden />
      {emblem ? <img className="gt-hero__emblem" src={emblem} alt="" aria-hidden /> : <div className="gt-hero__sigil" aria-hidden />}
      <div className="gt-hero__content">
        <div className="gt-hero__eyebrow">
          <span>{phase === 'leveling' ? 'Leveling phase' : 'Endgame phase'}</span>
          <span className="gt-hero__dot">◆</span>
          <span>{build ? CLASS_NAMES[build.classId] : 'No class'}</span>
          {build?.season ? (
            <>
              <span className="gt-hero__dot">◆</span>
              <span>{build.season}</span>
            </>
          ) : null}
        </div>
        <h1 className="gt-hero__title">{build?.name ?? 'Welcome to Grimtome'}</h1>
        <p className="gt-hero__summary">{build?.summary ?? 'Load your leveling and endgame builds to get item verdicts and progression guidance.'}</p>
        <div className="gt-hero__stats">
          <div className="gt-hero__stat">
            <span className="gt-hero__statlabel">Level</span>
            <Stepper value={progress.level} min={1} max={MAX_CHARACTER_LEVEL} onChange={setLevel} label="Character level" />
          </div>
          <div className="gt-hero__stat">
            <span className="gt-hero__statlabel">Paragon</span>
            <Stepper value={progress.paragon} min={0} max={MAX_PARAGON_LEVEL} onChange={setParagon} label="Paragon level" />
          </div>
        </div>
      </div>
      {build ? (
        <div className="gt-hero__class">
          <ClassEmblem classId={build.classId} size={112} />
        </div>
      ) : null}
    </section>
  );
}

function NextSkillCard() {
  const build = useApp(selectActiveBuild);
  const phase = useApp((s) => s.transition.phase);
  const allocated = useApp((s) => s.progress.skillSteps[phase]);
  const setSkillSteps = useApp((s) => s.setSkillSteps);
  const navigate = useApp((s) => s.navigate);
  if (!build) return null;
  const next = nextSkillPoint(build, allocated);
  return (
    <Panel
      variant="raised"
      eyebrow="Next skill point"
      title={next ? next.step.skill.name : 'Skill plan complete'}
      actions={<Button size="sm" variant="ghost" iconRight="chevronRight" onClick={() => navigate('skills')}>Plan</Button>}
      className="gt-dash-card"
    >
      {next ? (
        <div className="gt-dash-skill">
          <SkillIcon id={next.step.skill.id ?? null} name={next.step.skill.name} size={64} state="next" />
          <div className="gt-dash-skill__text">
            <div className="gt-dash-skill__label">{next.label}</div>
            <p className="gt-muted gt-small">Step {next.index + 1} of {next.total} in your imported {build.role} build.</p>
            <Meter value={next.index} max={next.total} label="Skill plan progress" />
          </div>
        </div>
      ) : (
        <p className="gt-muted">Every listed skill point is allocated. Nice work.</p>
      )}
      {next ? (
        <div className="gt-dash-card__actions">
          <Button size="sm" variant="primary" icon="check" onClick={() => setSkillSteps(phase, allocated + 1)}>
            Mark allocated
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSkillSteps(phase, allocated - 1)} disabled={allocated === 0}>
            Undo
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}

function ParagonCard() {
  const build = useApp(selectActiveBuild);
  const phase = useApp((s) => s.transition.phase);
  const completed = useApp((s) => s.progress.paragonCompleted[phase]);
  const toggle = useApp((s) => s.toggleParagonStep);
  const navigate = useApp((s) => s.navigate);
  if (!build) return null;
  const objective = currentParagonObjective(build, completed);
  const prog = paragonProgress(build, completed);
  return (
    <Panel
      variant="raised"
      eyebrow="Paragon objective"
      title={objective ? objective.board.name : build.paragon.length ? 'All boards complete' : 'No Paragon plan'}
      actions={<Button size="sm" variant="ghost" iconRight="chevronRight" onClick={() => navigate('paragon')}>Boards</Button>}
      className="gt-dash-card"
    >
      <div className="gt-dash-paragon">
        <Ring value={prog.done} max={Math.max(1, prog.total)} size={74}>
          <div className="gt-num gt-dash-ring__value">
            {prog.done}/{prog.total}
          </div>
          <div className="gt-dash-ring__label">boards</div>
        </Ring>
        <div className="gt-dash-paragon__text">
          {objective?.glyph ? (
            <div className="gt-row">
              <GlyphIcon id={objective.glyph.id ?? null} name={objective.glyph.name} size={30} />
              <span>
                Glyph <strong>{objective.glyph.name}</strong>
              </span>
            </div>
          ) : null}
          {objective?.focus ? <p className="gt-muted gt-small">{objective.focus}</p> : null}
          {objective?.targetParagon !== undefined ? <Badge tone="gold">Target Paragon {objective.targetParagon}</Badge> : null}
        </div>
      </div>
      {objective ? (
        <div className="gt-dash-card__actions">
          <Button size="sm" variant="secondary" icon="check" onClick={() => toggle(phase, objective.id)}>
            Complete milestone
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}

function TransitionCard() {
  const builds = useApp((s) => s.builds);
  const progress = useApp((s) => s.progress);
  const phase = useApp((s) => s.transition.phase);
  const navigate = useApp((s) => s.navigate);
  const r = readiness({ builds, progress });
  if (r.status === 'unavailable') {
    return (
      <Panel variant="raised" eyebrow="Build transition" title="No endgame build" className="gt-dash-card">
        <p className="gt-muted">Add an endgame build to track when you are ready to switch.</p>
        <div className="gt-dash-card__actions">
          <Button size="sm" variant="secondary" icon="builds" onClick={() => navigate('builds')}>
            Manage builds
          </Button>
        </div>
      </Panel>
    );
  }
  const done = phase === 'endgame';
  return (
    <Panel
      variant="raised"
      eyebrow="Build transition"
      title={done ? 'Endgame build active' : r.status === 'ready' ? 'Ready to transition' : 'Preparing for endgame'}
      className="gt-dash-card"
      actions={<Button size="sm" variant="ghost" iconRight="chevronRight" onClick={() => navigate('builds')}>Review</Button>}
    >
      <div className="gt-dash-paragon">
        <Ring value={done ? r.total : r.met} max={Math.max(1, r.total)} size={74} tone={r.status === 'ready' || done ? 'success' : 'arcane'}>
          <div className="gt-num gt-dash-ring__value">
            {done ? r.total : r.met}/{r.total}
          </div>
          <div className="gt-dash-ring__label">criteria</div>
        </Ring>
        <ul className="gt-dash-criteria">
          {(done ? [] : r.missing.slice(0, 3)).map((c) => (
            <li key={c.id}>
              <Icon name={c.required ? 'lock' : 'info'} size={13} />
              {c.label}
            </li>
          ))}
          {done ? <li className="is-done"><Icon name="check" size={13} />Item advice now targets {builds.endgame?.name}.</li> : null}
          {!done && r.missing.length === 0 ? <li className="is-done"><Icon name="check" size={13} />All requirements met.</li> : null}
        </ul>
      </div>
    </Panel>
  );
}

function QuickScan() {
  const hotkey = useApp((s) => s.settings.hotkeys.scan);
  const scans = useApp((s) => s.scans);
  const selectScan = useApp((s) => s.selectScan);
  const navigate = useApp((s) => s.navigate);
  const state = useEvalState();
  const { scanNow } = useScanController();
  const latest = scans[0];
  const ev = latest ? evaluate(state, latest.item) : null;
  return (
    <Panel variant="ornate" className="gt-quickscan" padding="lg">
      <div className="gt-quickscan__grid">
        <div>
          <div className="gt-section-label">Item Advisor</div>
          <h2 className="gt-quickscan__title">Hover. Press. Know what to keep.</h2>
          <p className="gt-muted">
            Hover an item in Diablo IV and press <KeyCap keys={hotkeyParts(hotkey)} size="sm" /> — Grimtome reads the tooltip and judges it against both of your builds.
          </p>
          <div className="gt-row gt-row--wrap" style={{ marginTop: 18 }}>
            <Button variant="primary" icon="scan" size="lg" onClick={() => void scanNow()}>
              Scan item
            </Button>
            <Button variant="secondary" icon="upload" size="lg" onClick={() => navigate('advisor')}>
              Upload screenshot
            </Button>
          </div>
        </div>
        <div className="gt-quickscan__latest">
          {latest && ev ? (
            <button
              type="button"
              className="gt-latest"
              data-verdict={ev.verdict}
              onClick={() => {
                selectScan(latest.id);
                navigate('advisor');
              }}
            >
              <ItemIcon slot={latest.item.slot} rarity={latest.item.rarity} size={58} />
              <div className="gt-latest__text">
                <div className="gt-section-label">Last scan · {timeAgo(latest.at)}</div>
                <div className="gt-latest__name" data-rarity={latest.item.rarity ?? 'common'}>
                  {latest.item.name ?? 'Unknown item'}
                </div>
                <VerdictBadge verdict={ev.verdict} />
              </div>
            </button>
          ) : (
            <EmptyState compact icon="advisor" title="No scans yet" body="Your latest verdict will appear here." />
          )}
        </div>
      </div>
    </Panel>
  );
}

function RecentScans() {
  const scans = useApp((s) => s.scans);
  const state = useEvalState();
  const selectScan = useApp((s) => s.selectScan);
  const navigate = useApp((s) => s.navigate);
  if (scans.length < 2) return null;
  return (
    <Panel title="Recent verdicts" eyebrow="History" padding="sm">
      <ul className="gt-recent">
        {scans.slice(0, 6).map((sc) => {
          const ev = evaluate(state, sc.item);
          return (
            <li key={sc.id}>
              <button
                type="button"
                onClick={() => {
                  selectScan(sc.id);
                  navigate('advisor');
                }}
              >
                <ItemIcon slot={sc.item.slot} rarity={sc.item.rarity} size={36} />
                <span className="gt-recent__name" data-rarity={sc.item.rarity ?? 'common'}>
                  {sc.item.name ?? 'Unknown item'}
                </span>
                <span className="gt-recent__time">{timeAgo(sc.at)}</span>
                <VerdictBadge verdict={ev.verdict} size="sm" short />
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function DashboardScreen() {
  const build = useApp(selectActiveBuild);
  const loadSamples = useApp((s) => s.loadSampleBuilds);
  const navigate = useApp((s) => s.navigate);
  return (
    <div className="gt-stack gt-dashboard">
      <Hero />
      {build ? (
        <>
          <QuickScan />
          <div className="gt-grid gt-grid--3">
            <NextSkillCard />
            <ParagonCard />
            <TransitionCard />
          </div>
          <RecentScans />
        </>
      ) : (
        <Panel variant="ornate" padding="lg">
          <EmptyState
            icon="builds"
            title="Bring your builds"
            body="Grimtome compares every item against a leveling build and the endgame build you are working toward."
            actions={
              <>
                <Button variant="primary" icon="builds" onClick={() => navigate('builds')}>
                  Import builds
                </Button>
                <Button variant="secondary" icon="sparkle" onClick={loadSamples}>
                  Try sample builds
                </Button>
              </>
            }
          />
        </Panel>
      )}
    </div>
  );
}
