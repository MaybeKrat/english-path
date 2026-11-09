const DEFAULT_WIDTH = 1400;
const DEFAULT_HEIGHT = 920;
const WINDOW_MARGIN = 24;

function getInitialWindowLayout(workArea) {
  // Electron supplies work areas in DIP, already adjusted for display scaling
  // and the taskbar. Keep the restored window entirely on the chosen display.
  const availableWidth = Math.max(1, workArea.width - WINDOW_MARGIN * 2);
  const availableHeight = Math.max(1, workArea.height - WINDOW_MARGIN * 2);
  const width = Math.min(DEFAULT_WIDTH, availableWidth);
  const height = Math.min(DEFAULT_HEIGHT, availableHeight);

  return {
    options: {
      x: workArea.x + Math.floor((workArea.width - width) / 2),
      y: workArea.y + Math.floor((workArea.height - height) / 2),
      width,
      height,
      minWidth: Math.min(900, availableWidth),
      minHeight: Math.min(640, availableHeight),
    },
    // A maximized window gives smaller / scaled screens all available space.
    maximize: availableWidth < DEFAULT_WIDTH || availableHeight < DEFAULT_HEIGHT,
  };
}

// The window reopens where it was closed (Ivan, 09.11.2026). A saved window counts only while enough of it lies on a
// current display, so a disconnected monitor does not leave it off-screen.
const MIN_VISIBLE_WIDTH = 200;
const MIN_VISIBLE_HEIGHT = 100;

function isSavedWindow(value) {
  return (
    !!value &&
    typeof value === "object" &&
    ["x", "y", "width", "height"].every((key) => Number.isFinite(value[key])) &&
    value.width >= 100 &&
    value.height >= 100
  );
}

function overlap(a, b) {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width >= MIN_VISIBLE_WIDTH && height >= MIN_VISIBLE_HEIGHT ? width * height : 0;
}

/** Layout of the window saved at the last close, fitted into the display it is on; null when it cannot be used. */
function getRestoredWindowLayout(saved, workAreas) {
  if (!isSavedWindow(saved)) return null;
  const area = workAreas
    .map((workArea) => ({ workArea, shared: overlap(saved, workArea) }))
    .filter((item) => item.shared > 0)
    .sort((a, b) => b.shared - a.shared)[0]?.workArea;
  if (!area) return null;
  const width = Math.round(Math.min(saved.width, area.width));
  const height = Math.round(Math.min(saved.height, area.height));
  const clamp = (value, min, max) => Math.round(Math.min(Math.max(value, min), max));
  return {
    options: {
      x: clamp(saved.x, area.x, area.x + area.width - width),
      y: clamp(saved.y, area.y, area.y + area.height - height),
      width,
      height,
      minWidth: Math.min(900, width),
      minHeight: Math.min(640, height),
    },
    maximize: saved.maximized === true,
  };
}

module.exports = { getInitialWindowLayout, getRestoredWindowLayout };
