import type { SVGProps } from 'react';

/**
 * Grimtome's original icon set: 24×24 grid, 1.6px strokes, round joins.
 * Drawn for this project (no third-party or game artwork).
 */

export type IconName = keyof typeof PATHS;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  title?: string;
}

const PATHS = {
  // Navigation
  dashboard: (
    <>
      <path d="M4 20V10.5L12 4l8 6.5V20" />
      <path d="M9.5 20v-5.5a2.5 2.5 0 0 1 5 0V20" />
      <path d="M3 20h18" />
    </>
  ),
  advisor: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v1.5M12 20v1.5" />
    </>
  ),
  skills: (
    <>
      <path d="M12 3 4.5 7.5v9L12 21l7.5-4.5v-9Z" />
      <path d="m13 7.5-3 5h4l-3 4.5" />
    </>
  ),
  paragon: (
    <>
      <path d="M12 2.8 21.2 12 12 21.2 2.8 12Z" />
      <path d="M12 7.5 16.5 12 12 16.5 7.5 12Z" />
      <path d="M12 2.8v4.7M12 16.5v4.7M2.8 12h4.7M16.5 12h4.7" />
    </>
  ),
  builds: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5Z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" />
      <path d="m12 7 1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 13l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4Z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M4.4 4.4l2.1 2.1M17.5 17.5l2.1 2.1M2.5 12h3M18.5 12h3M4.4 19.6l2.1-2.1M17.5 6.5l2.1-2.1" />
      <circle cx="12" cy="12" r="6.5" />
    </>
  ),
  // Actions
  scan: (
    <>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 14.5v4A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-4" />
    </>
  ),
  paste: (
    <>
      <path d="M9 4.5H6.5A1.5 1.5 0 0 0 5 6v13.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H15" />
      <rect x="9" y="3" width="6" height="3.2" rx="1" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
    </>
  ),
  overlay: (
    <>
      <rect x="3" y="7" width="13" height="13" rx="1.5" />
      <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4H19.5A1.5 1.5 0 0 1 21 5.5v10a1.5 1.5 0 0 1-1.5 1.5H16" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  minimize: <path d="M6 12h12" />,
  maximize: <rect x="6" y="6" width="12" height="12" rx="1" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  trash: (
    <>
      <path d="M4.5 7h15M10 4h4M6.5 7l.9 12.1A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
      <path d="M10 11v5.5M14 11v5.5" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4.5L19.3 9.2a2.1 2.1 0 0 0-3-3L5.5 17v3" />
      <path d="m14.5 8 3 3" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
      <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.6v.1" />
    </>
  ),
  warning: (
    <>
      <path d="M10.6 4.3 2.9 17.8A1.6 1.6 0 0 0 4.3 20.2h15.4a1.6 1.6 0 0 0 1.4-2.4L13.4 4.3a1.6 1.6 0 0 0-2.8 0Z" />
      <path d="M12 9.5v4.5M12 17v.1" />
    </>
  ),
  sparkle: (
    <path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7Z M19 15.5c.2 1.4.9 2.1 2.3 2.3-1.4.2-2.1.9-2.3 2.3-.2-1.4-.9-2.1-2.3-2.3 1.4-.2 2.1-.9 2.3-2.3Z" />
  ),
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 9.5h.1M9.5 9.5h.1M13 9.5h.1M16.5 9.5h1.5M6 13h.1M9.5 13h5M18 13h.1M8 16h8" />
    </>
  ),
  folder: <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.6l2 2h8.4A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5Z" />,
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.6c.5-.1.9-.1 1.4-.1C18 5.5 21.5 12 21.5 12a17 17 0 0 1-3 3.8M6.3 7.3A16.8 16.8 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.9-.4 4.1-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  swap: (
    <>
      <path d="M4 8h14M14.5 4.5 18 8l-3.5 3.5" />
      <path d="M20 16H6M9.5 12.5 6 16l3.5 3.5" />
    </>
  ),
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4.5h11l-2 4 2 4H5" />
    </>
  ),
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3.5 4.5v4h4" />
      <path d="M12 8v4.5l3 2" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3.3-3.3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0L5 13.3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 14.5v4A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r=".6" />
    </>
  ),
  crown: (
    <>
      <path d="M4 18.5h16M5 15.5 3.5 7l5 3.5L12 5l3.5 5.5 5-3.5-1.5 8.5Z" />
    </>
  ),
  gem: (
    <>
      <path d="M7 4h10l4 5.5L12 20 3 9.5Z" />
      <path d="M3 9.5h18M9.5 4 12 9.5 14.5 4M12 9.5V20" />
    </>
  ),
  // Verdicts
  upgrade: (
    <>
      <path d="M12 20V6" />
      <path d="m6.5 11.5 5.5-5.5 5.5 5.5" />
      <path d="m6.5 6.5 5.5-5.5 5.5 5.5" opacity=".55" />
    </>
  ),
  keep: (
    <>
      <path d="M12 21s7.5-3.2 7.5-9.5V5.5L12 3 4.5 5.5v6C4.5 17.8 12 21 12 21Z" />
      <path d="m8.8 12 2.3 2.3 4.4-4.6" />
    </>
  ),
  stash: (
    <>
      <path d="M3.5 10h17v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19Z" />
      <path d="M3.5 10V8.5C3.5 5.5 7 3.5 12 3.5s8.5 2 8.5 5V10" />
      <rect x="10.2" y="9" width="3.6" height="4.2" rx=".8" />
    </>
  ),
  salvage: (
    <>
      <path d="m13.5 6.5 4 4" />
      <path d="M9.6 3.6 15 9l-2.4 2.4L7.2 6Z" />
      <path d="m11.2 10.6-7.4 7.4a1.6 1.6 0 0 0 2.2 2.2l7.4-7.4" />
      <path d="M15.5 19.5h5" />
    </>
  ),
  review: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
      <path d="M8.8 8.9a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.9.8-.9 1.4M10.5 14v.1" />
    </>
  ),
  // Equipment slots
  helm: (
    <>
      <path d="M5 13.5C5 8 8 4 12 4s7 4 7 9.5V20h-4.5v-4.5h-5V20H5Z" />
      <path d="M8.5 11h7M12 4v7" />
    </>
  ),
  chest: (
    <>
      <path d="M8 3.5 4 6v6l2 1v7.5h12V13l2-1V6l-4-2.5" />
      <path d="M8 3.5c0 2.2 1.8 4 4 4s4-1.8 4-4" />
      <path d="M12 7.5V20.5M8 13h8" />
    </>
  ),
  gloves: (
    <>
      <path d="M7 20.5V13L5 9.5a1.4 1.4 0 0 1 2.4-1.4L9 10.5V4.8a1.3 1.3 0 0 1 2.6 0V10V3.8a1.3 1.3 0 0 1 2.6 0V10V5a1.3 1.3 0 0 1 2.6 0v7.5c0 3.2-1 5-2.8 6v2" />
      <path d="M7 17h9.5" />
    </>
  ),
  pants: (
    <>
      <path d="M6.5 3.5h11l1 17h-4.5L12 9.5l-2 11H5.5Z" />
      <path d="M6.5 6.5h11" />
    </>
  ),
  boots: (
    <>
      <path d="M7.5 3.5h6v9l5.2 2.2a2 2 0 0 1 1.3 1.9v2.9H4.5v-3.5L7.5 13Z" />
      <path d="M7.5 8h6M4.5 17h15.5" />
    </>
  ),
  amulet: (
    <>
      <path d="M5 3.5c0 5 3 8.5 7 8.5s7-3.5 7-8.5" />
      <path d="M12 12v1.5" />
      <path d="m12 13.5 3.5 3.5L12 20.5 8.5 17Z" />
    </>
  ),
  ring: (
    <>
      <circle cx="12" cy="14.5" r="6" />
      <path d="M9.5 8.9 8.5 5.5 10.5 3h3l2 2.5-1 3.4" />
    </>
  ),
  weapon: (
    <>
      <path d="M19.5 4.5 10 14l-2.5-.5L18 3h1.5Z" />
      <path d="m6 12 6 6M7.5 16.5 4 20M5 18.5l-1 2.5 2.5-1" />
    </>
  ),
  offhand: (
    <>
      <path d="M12 21s7.5-3.2 7.5-9.5V5.5L12 3 4.5 5.5v6C4.5 17.8 12 21 12 21Z" />
      <path d="M12 3v18M4.6 10h14.8" />
    </>
  ),
  sigil: (
    <>
      <path d="M12 2.5 14.2 9.8 21.5 12 14.2 14.2 12 21.5 9.8 14.2 2.5 12 9.8 9.8Z" />
      <circle cx="12" cy="12" r="2.4" />
    </>
  ),
} as const;

export function Icon({ name, size = 18, strokeWidth = 1.6, title, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}
