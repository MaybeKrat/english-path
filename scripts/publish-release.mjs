// Publishes English Path on GitHub.
// 1. The voice pack (release/English-Path-voices.pack, made by scripts/build-voice-pack.mjs) goes to its own release
//    voices-<hash> named in desktop/voice-pack.json, once: unchanged recordings are not uploaded again.
// 2. With a notes file, the app release v<version from package.json> gets release/English-Path-Setup.exe.
//    The version must already be committed and tagged (v<version>) and the tag pushed.
// Usage: node scripts/publish-release.mjs [notes.md]
// Repeated runs are safe: existing releases and assets are kept.
import { spawnSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'MaybeKrat/english-path';
const root = resolve(fileURLToPath(import.meta.url), '../..');

/** The same GitHub token git uses for push, from the Windows credential manager; it is never printed. */
function githubToken() {
  const result = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
    env: { ...process.env, GCM_INTERACTIVE: 'Never', GIT_TERMINAL_PROMPT: '0' },
  });
  const token = /^password=(.+)$/m.exec(result.stdout ?? '')?.[1];
  if (!token) throw new Error('git не вернул токен GitHub: сначала выполните git push, чтобы git запомнил вход.');
  return token;
}

async function github(token, url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', ...init.headers },
  });
  if (response.status === 404 && init.allow404) return null;
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${url}: ${response.status} ${await response.text()}`);
  return response.json();
}

const token = githubToken();
const api = `https://api.github.com/repos/${REPO}`;

async function ensureRelease(fields) {
  return (
    (await github(token, `${api}/releases/tags/${fields.tag_name}`, { allow404: true })) ??
    (await github(token, `${api}/releases`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(fields),
    }))
  );
}

async function ensureAsset(release, name, file, expectedSize) {
  const size = (await stat(file)).size;
  if (expectedSize !== undefined && size !== expectedSize)
    throw new Error(`${file}: ${size} байт, а в desktop/voice-pack.json ${expectedSize}. Пересоберите пакет.`);
  const existing = release.assets.find((asset) => asset.name === name);
  if (existing) {
    console.log(`${name} уже приложен к ${release.tag_name} (${existing.size} байт), загрузка пропущена.`);
    return;
  }
  const asset = await github(token, `https://uploads.github.com/repos/${REPO}/releases/${release.id}/assets?name=${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', 'content-length': String(size) },
    body: await readFile(file),
  });
  console.log(`Загружен ${asset.name}: ${asset.size} байт.`);
}

const voices = JSON.parse(await readFile(resolve(root, 'desktop', 'voice-pack.json'), 'utf8'));
const voiceRelease = await ensureRelease({
  tag_name: voices.tag,
  target_commitish: 'main',
  name: `Озвучка (${voices.tag})`,
  body: `Записи произношения для English Path: ${voices.recordings} записей. Приложение скачивает этот файл само после установки; вручную скачивать не нужно.`,
  make_latest: 'false',
});
await ensureAsset(voiceRelease, voices.url.split('/').pop(), resolve(root, 'release', 'English-Path-voices.pack'), voices.size);
console.log(voiceRelease.html_url);

const notesPath = process.argv[2];
if (notesPath) {
  const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const release = await ensureRelease({
    tag_name: `v${version}`,
    name: `English Path ${version}`,
    body: await readFile(resolve(notesPath), 'utf8'),
    make_latest: 'true',
  });
  await ensureAsset(release, 'English-Path-Setup.exe', resolve(root, 'release', 'English-Path-Setup.exe'));
  console.log(release.html_url);
}
