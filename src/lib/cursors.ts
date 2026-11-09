/**
 * Mouse cursors that grow with the interface scale of the desktop app.
 * Chromium scales custom cursors by the Windows display scale but not by page zoom,
 * so every scale step gets its own image size. Shapes are drawn in their own units;
 * BASE_SCALE makes the arrow about as tall as the standard Windows arrow at 100%.
 */
const BASE_SCALE = 0.85;

interface CursorShape {
  width: number;
  height: number;
  hotspot: [number, number];
  body: string;
  fallback: string;
}

const outline = 'stroke="#000" stroke-linejoin="round" stroke-linecap="round"';

const arrow: CursorShape = {
  width: 15,
  height: 24,
  hotspot: [1, 1],
  body: `<path d="M1 1v19l4.3-4.2 3.2 7.2 3-1.3-3.1-7.1h6z" fill="#fff" ${outline} stroke-width="1.3"/>`,
  fallback: 'auto',
};

// The hand is drawn twice: a thick black pass gives the outline, a white pass fills it.
const handShapes =
  '<rect x="7" y="1" width="4.4" height="15" rx="2.2"/>' +
  '<rect x="11.4" y="8" width="4" height="9" rx="2"/>' +
  '<rect x="15.4" y="9" width="3.8" height="9" rx="1.9"/>' +
  '<rect x="19.2" y="10.5" width="3.5" height="8" rx="1.75"/>' +
  '<path d="M7 13h15.7v7a7 7 0 0 1-7 7H12a6 6 0 0 1-4.5-2L2 18.5a1.8 1.8 0 0 1 2.6-2.5L7 18z"/>';
const hand: CursorShape = {
  width: 24,
  height: 28,
  hotspot: [9, 1],
  body:
    `<g fill="#000" ${outline} stroke-width="2.2">${handShapes}</g>` +
    `<g fill="#fff">${handShapes}</g>` +
    `<path d="M11.4 10v5M15.4 11v5.5M19.2 12.5v5" ${outline} stroke-width="0.8"/>`,
  fallback: 'pointer',
};

const beamPath = 'M2 1.5c1.7 0 3 .6 3 2v15c0 1.4 1.3 2 3 2M8 1.5c-1.7 0-3 .6-3 2v15c0 1.4-1.3 2-3 2';
const textBeam: CursorShape = {
  width: 10,
  height: 22,
  hotspot: [5, 11],
  body:
    `<path d="${beamPath}" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>` +
    `<path d="${beamPath}" fill="none" stroke="#000" stroke-width="1.3" stroke-linecap="round"/>`,
  fallback: 'text',
};

function cursorValue(shape: CursorShape, scale: number): string {
  const width = Math.ceil(shape.width * scale);
  const height = Math.ceil(shape.height * scale);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${shape.width} ${shape.height}">${shape.body}</svg>`;
  const [x, y] = shape.hotspot.map((value) => Math.round(value * scale));
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, ${shape.fallback}`;
}

/** CSS cursor values for a scale in percent; null keeps the Windows cursors (100% and below). */
export function scaledCursors(zoom: number): { default: string; pointer: string; text: string } | null {
  if (zoom <= 100) return null;
  const scale = (BASE_SCALE * zoom) / 100;
  return { default: cursorValue(arrow, scale), pointer: cursorValue(hand, scale), text: cursorValue(textBeam, scale) };
}
