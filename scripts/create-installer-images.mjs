// Renders the installer pictures from desktop/installer/*.svg into the BMP files electron-builder takes from
// desktop/resources: installerSidebar.bmp and uninstallerSidebar.bmp (welcome and finish pages, 164 × 314 dialog
// pixels) and installerHeader.bmp (inner pages, 150 × 57). NSIS stretches the bitmap to the control size, so the
// pictures are drawn for Windows scale 125% (Ivan's monitor, 09.11.2026) to stay sharp there.
// PNG copies for review go to work/installer-preview. Usage: node scripts/create-installer-images.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const SCALE = 1.25;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resources = path.join(root, "desktop", "resources");
const preview = path.join(root, "work", "installer-preview");

/** 24-bit bottom-up BMP, the format NSIS loads. */
function bmp(width, height, rgba) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const file = Buffer.alloc(54 + rowSize * height);
  file.write("BM", 0, "latin1");
  file.writeUInt32LE(file.length, 2);
  file.writeUInt32LE(54, 10);
  file.writeUInt32LE(40, 14);
  file.writeInt32LE(width, 18);
  file.writeInt32LE(height, 22);
  file.writeUInt16LE(1, 26);
  file.writeUInt16LE(24, 28);
  file.writeUInt32LE(rowSize * height, 34);
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const pixel = (y * width + x) * 4;
      // The pictures are opaque; blend on white just in case an edge pixel is not.
      const alpha = rgba[pixel + 3] / 255;
      for (let channel = 0; channel < 3; channel++) {
        file[row + x * 3 + (2 - channel)] = Math.round(rgba[pixel + channel] * alpha + 255 * (1 - alpha));
      }
    }
  }
  return file;
}

await mkdir(preview, { recursive: true });
for (const [source, width, targets] of [
  ["sidebar.svg", 164, ["installerSidebar.bmp", "uninstallerSidebar.bmp"]],
  ["header.svg", 150, ["installerHeader.bmp"]],
]) {
  const svg = await readFile(path.join(root, "desktop", "installer", source), "utf8");
  const image = new Resvg(svg, {
    fitTo: { mode: "width", value: Math.round(width * SCALE) },
    font: { loadSystemFonts: true, defaultFontFamily: "Segoe UI" },
  }).render();
  for (const target of targets) await writeFile(path.join(resources, target), bmp(image.width, image.height, image.pixels));
  await writeFile(path.join(preview, source.replace(".svg", ".png")), image.asPng());
  console.log(`${source}: ${image.width} × ${image.height} → ${targets.join(", ")}`);
}
