import { readiness, useApp } from '@/app/store';
import { shouldPromptTransition } from '@/domain/progression/transition';
import { Button, Icon } from '@/design-system';
import { useT } from '@/shared/i18n';
import './transition-banner.css';

/** Shown across screens when the endgame transition becomes available. Never switches on its own. */
export function TransitionBanner() {
  const builds = useApp((s) => s.builds);
  const progress = useApp((s) => s.progress);
  const state = useApp((s) => s.transition);
  const navigate = useApp((s) => s.navigate);
  const postpone = useApp((s) => s.postponeTransition);
  const t = useT();
  const r = readiness({ builds, progress });
  if (!shouldPromptTransition(state, r, progress)) return null;
  return (
    <div className="gt-tbanner" role="status">
      <span className="gt-tbanner__icon">
        <Icon name="flag" size={18} />
      </span>
      <div className="gt-tbanner__text">
        <strong>{t('transition.available')}</strong>
        <span>Your character has reached the recommended progression stage for {builds.endgame?.name}.</span>
      </div>
      <Button size="sm" variant="arcane" icon="chevronRight" onClick={() => navigate('builds')}>
        Review
      </Button>
      <Button size="sm" variant="ghost" onClick={() => postpone(progress.paragon + 10)}>
        Later
      </Button>
    </div>
  );
}
