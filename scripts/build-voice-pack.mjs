// Packs public/voices/<voice>/<key>.mp3 into release/English-Path-voices.pack (format: desktop/voice-pack.cjs)
// and writes desktop/voice-pack.json: the download address, size and SHA-256 the app checks.
// The pack is deterministic, so unchanged recordings give the same hash and the same release tag voices-<hash>.
// Usage: node scripts/build-voice-pack.mjs
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = 'MaybeKrat/english-path';
export const PACK_NAME = 'English-Path-voices.pack';
const root = resolve(fileURLToPath(import.meta.url), '../..');
const voicesDir = join(root, 'public', 'voices');

const index = {};
const chunks = [];
let offset = 0;
for (const voice of (await readdir(voicesDir)).sort()) {
  for (const name of (await readdir(join(voicesDir, voice))).filter((file) => file.endsWith('.mp3')).sort()) {
    const data = await readFile(join(voicesDir, voice, name));
    index[`${voice}/${name.slice(0, -4)}`] = [offset, data.length];
    chunks.push(data);
    offset += data.length;
  }
}
const indexBuffer = Buffer.from(JSON.stringify(index), 'utf8');
const head = Buffer.alloc(12);
head.write('EPVOICE1', 0, 'latin1');
head.writeUInt32LE(indexBuffer.length, 8);
const pack = Buffer.concat([head, indexBuffer, ...chunks]);
const sha256 = createHash('sha256').update(pack).digest('hex');

await mkdir(join(root, 'release'), { recursive: true });
await writeFile(join(root, 'release', PACK_NAME), pack);
const manifest = {
  tag: `voices-${sha256.slice(0, 12)}`,
  url: `https://github.com/${REPO}/releases/download/voices-${sha256.slice(0, 12)}/${PACK_NAME}`,
  size: pack.length,
  sha256,
  recordings: Object.keys(index).length,
};
await writeFile(join(root, 'desktop', 'voice-pack.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${PACK_NAME}: ${manifest.recordings} записей, ${(pack.length / 1048576).toFixed(1)} МБ, ${manifest.tag}`);
