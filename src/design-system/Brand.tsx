import { useId } from 'react';

/**
 * Grimtome's original brand mark: an open tome inside a gothic arch, under a
 * four-pointed guiding star. Shared by the title bar, onboarding and the app icon.
 */
export function BrandMark({ size = 28, glow = true }: { size?: number; glow?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Grimtome">
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbecc4" />
          <stop offset="50%" stopColor="#dcb36e" />
          <stop offset="100%" stopColor="#9a7038" />
        </linearGradient>
        <radialGradient id={`${id}-core`} cx="50%" cy="38%" r="60%">
          <stop offset="0%" stopColor="#3a1a12" />
          <stop offset="100%" stopColor="#0d0807" />
        </radialGradient>
        {glow ? (
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ) : null}
      </defs>
      <path
        d="M24 2.5c8.6 5.2 16.5 11 16.5 22.5v20H7.5V25C7.5 13.5 15.4 7.7 24 2.5Z"
        fill={`url(#${id}-core)`}
        stroke={`url(#${id}-gold)`}
        strokeWidth="1.6"
      />
      <path
        d="M24 7.2c6.4 4.2 12 8.8 12 18.2V41.6H12V25.4C12 16 17.6 11.4 24 7.2Z"
        fill="none"
        stroke={`url(#${id}-gold)`}
        strokeWidth=".7"
        opacity=".55"
      />
      <g filter={glow ? `url(#${id}-glow)` : undefined}>
        <path d="M24 12.2l1.5 4.3 4.3 1.5-4.3 1.5-1.5 4.3-1.5-4.3-4.3-1.5 4.3-1.5Z" fill="#ffe2a3" />
      </g>
      <path
        d="M13.5 27.2c3.9-2.3 7.5-2.3 10.5 0v11c-3-2.3-6.6-2.3-10.5 0Z"
        fill="#1a110c"
        stroke={`url(#${id}-gold)`}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M34.5 27.2c-3.9-2.3-7.5-2.3-10.5 0v11c3-2.3 6.6-2.3 10.5 0Z"
        fill="#1a110c"
        stroke={`url(#${id}-gold)`}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M16.2 30.4c2.4-1 4.6-1 6.4.2M16.2 33.4c2.4-1 4.6-1 6.4.2M31.8 30.4c-2.4-1-4.6-1-6.4.2M31.8 33.4c-2.4-1-4.6-1-6.4.2"
        stroke="#b58a4c"
        strokeWidth=".7"
        fill="none"
        opacity=".8"
      />
    </svg>
  );
}

export function Wordmark({ size = 15 }: { size?: number }) {
  return (
    <span
      style={{
        fontFamily: 'var(--gt-font-display)',
        fontWeight: 700,
        fontSize: size,
        letterSpacing: '0.32em',
        background: 'linear-gradient(180deg, #fbefcf, #d8b06c 60%, #a57c42)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        paddingLeft: '0.32em',
      }}
    >
      GRIMTOME
    </span>
  );
}
