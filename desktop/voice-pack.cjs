// Recorded voices are not shipped in the installer: the app downloads one pack file from the GitHub release in the
// background and serves recordings from it. Until the pack is ready, words are spoken by the Windows voice.
//
// Pack format (scripts/build-voice-pack.mjs): "EPVOICE1", uint32 LE length of a JSON index, the index
// {"<voice>/<key>": [offset, length]} with offsets from the end of the index, then the MP3 data.
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const MAGIC = "EPVOICE1";
const RETRY_DELAYS = [30_000, 60_000, 5 * 60_000, 15 * 60_000];

/** Opens a pack and returns a reader; throws when the file is not a pack. */
async function openPack(file) {
  const handle = await fsp.open(file, "r");
  try {
    const head = Buffer.alloc(12);
    await handle.read(head, 0, 12, 0);
    if (head.toString("latin1", 0, 8) !== MAGIC) throw new Error("Файл не является пакетом озвучки.");
    const indexLength = head.readUInt32LE(8);
    const indexBuffer = Buffer.alloc(indexLength);
    await handle.read(indexBuffer, 0, indexLength, 12);
    const index = new Map(Object.entries(JSON.parse(indexBuffer.toString("utf8"))));
    const dataStart = 12 + indexLength;
    return {
      size: index.size,
      async read(name) {
        const entry = index.get(name);
        if (!entry) return null;
        const [offset, length] = entry;
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, dataStart + offset);
        return buffer;
      },
      close: () => handle.close(),
    };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

async function sha256(file) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

/**
 * @param {{ dir: string, manifest: { url: string, size: number, sha256: string }, fetchImpl?: typeof fetch,
 *   onStatus?: (status: object) => void, retryDelays?: number[] }} options
 */
function createVoicePack({ dir, manifest, fetchImpl = fetch, onStatus = () => {}, retryDelays = RETRY_DELAYS }) {
  const file = path.join(dir, "voices.pack");
  const partial = `${file}.part`;
  const metaFile = path.join(dir, "voices.json");
  let reader = null;
  let status = { state: "checking", received: 0, total: manifest.size };
  let retryTimer = null;
  let attempt = 0;
  let disposed = false;
  let controller = null;

  const setStatus = (next) => {
    status = { ...status, ...next };
    onStatus(status);
  };

  async function verified() {
    try {
      const meta = JSON.parse(await fsp.readFile(metaFile, "utf8"));
      const { size } = await fsp.stat(file);
      return meta.sha256 === manifest.sha256 && size === manifest.size;
    } catch {
      return false;
    }
  }

  async function download() {
    let offset = 0;
    try {
      offset = (await fsp.stat(partial)).size;
    } catch {}
    if (offset > manifest.size) {
      await fsp.rm(partial, { force: true });
      offset = 0;
    }
    if (offset < manifest.size) {
      controller = new AbortController();
      const response = await fetchImpl(manifest.url, {
        headers: offset ? { range: `bytes=${offset}-` } : {},
        signal: controller.signal,
      });
      if (response.status === 200 && offset) offset = 0; // the server ignored the range
      else if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const out = fs.createWriteStream(partial, { flags: offset ? "a" : "w" });
      const finished = new Promise((resolve, reject) => {
        out.on("finish", resolve);
        out.on("error", reject);
      });
      let received = offset;
      setStatus({ state: "downloading", received });
      try {
        for await (const chunk of response.body) {
          if (disposed) break;
          received += chunk.length;
          if (received > manifest.size) throw new Error("Пакет озвучки больше ожидаемого.");
          if (!out.write(chunk)) await new Promise((resolve) => out.once("drain", resolve));
          setStatus({ received });
        }
      } finally {
        out.end();
        await finished;
      }
      if (disposed) return;
    }
    setStatus({ state: "verifying", received: manifest.size });
    if ((await sha256(partial)) !== manifest.sha256) {
      await fsp.rm(partial, { force: true });
      throw new Error("Пакет озвучки повреждён, он будет скачан заново.");
    }
    await fsp.rm(file, { force: true });
    await fsp.rename(partial, file);
    await fsp.writeFile(metaFile, JSON.stringify({ sha256: manifest.sha256, size: manifest.size }));
  }

  async function run() {
    retryTimer = null;
    try {
      await fsp.mkdir(dir, { recursive: true });
      if (!(await verified())) {
        await download();
        if (disposed) return;
      }
      reader = await openPack(file);
      setStatus({ state: "ready", received: manifest.size, error: undefined });
    } catch (error) {
      if (disposed) return;
      reader = null;
      const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)];
      attempt += 1;
      setStatus({ state: "error", error: error.message, retryAt: Date.now() + delay });
      retryTimer = setTimeout(run, delay);
    }
  }

  return {
    start: () => run(),
    status: () => status,
    /** MP3 bytes of a recording, or null when the pack is not ready or has no such recording. */
    read: (voice, key) => (reader ? reader.read(`${voice}/${key}`) : Promise.resolve(null)),
    dispose() {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      controller?.abort();
      reader?.close();
    },
  };
}

module.exports = { createVoicePack, openPack, MAGIC };
