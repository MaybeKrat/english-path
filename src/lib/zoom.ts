/**
 * Interface scale of the desktop app, in percent; the same steps as in Chromium browsers.
 * 250% and 300% are for studying at a distance from the screen (08.11.2026).
 */
export const ZOOM_LEVELS = [75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300] as const;

export const DEFAULT_ZOOM = 100;

export function isZoom(value: unknown): value is number {
  return (ZOOM_LEVELS as readonly unknown[]).includes(value);
}

/** Next scale step up (+1) or down (-1); stays at the ends of the list. */
export function stepZoom(current: number, direction: 1 | -1): number {
  const index = ZOOM_LEVELS.indexOf(current as (typeof ZOOM_LEVELS)[number]);
  if (index === -1) return DEFAULT_ZOOM;
  return ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, index + direction))];
}
