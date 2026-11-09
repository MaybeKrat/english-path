import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createVoicePack, MAGIC } = require("../desktop/voice-pack.cjs");

function makePack(recordings: Record<string, string>) {
  const index: Record<string, [number, number]> = {};
  let offset = 0;
  for (const [name, text] of Object.entries(recordings)) {
    index[name] = [offset, Buffer.byteLength(text)];
    offset += Buffer.byteLength(text);
  }
  const indexBuffer = Buffer.from(JSON.stringify(index));
  const head = Buffer.alloc(12);
  head.write(MAGIC, 0, "latin1");
  head.writeUInt32LE(indexBuffer.length, 8);
  const pack = Buffer.concat([head, indexBuffer, ...Object.values(recordings).map((text) => Buffer.from(text))]);
  return { pack, manifest: { url: "https://example.test/voices.pack", size: pack.length, sha256: createHash("sha256").update(pack).digest("hex") } };
}

/** Serves the pack, breaking off the first response halfway to check that the download resumes. */
function server(pack: Buffer) {
  const requests: (string | undefined)[] = [];
  const fetchImpl = async (_url: string, init: { headers: Record<string, string> }) => {
    const range = init.headers.range;
    requests.push(range);
    const start = range ? Number(/bytes=(\d+)-/.exec(range)![1]) : 0;
    const body = pack.subarray(start);
    const half = Math.floor(pack.length / 2);
    const broken = requests.length === 1;
    return {
      ok: true,
      status: range ? 206 : 200,
      body: (async function* () {
        yield broken ? body.subarray(0, half) : body;
        if (broken) throw new Error("connection reset");
      })(),
    };
  };
  return { fetchImpl, requests };
}

async function waitFor(pack: { status(): { state: string } }, state: string) {
  for (let i = 0; i < 200 && pack.status().state !== state; i += 1) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(pack.status().state, state);
}

test("Voice pack resumes an interrupted download, verifies it and serves recordings", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "voice-pack-"));
  try {
    const { pack, manifest } = makePack({ "ryan/0000000000000001": "first", "sonia/0000000000000002": "second" });
    const { fetchImpl, requests } = server(pack);
    const voices = createVoicePack({ dir, manifest, fetchImpl, retryDelays: [1] });
    assert.equal(await voices.read("ryan", "0000000000000001"), null);
    voices.start();
    await waitFor(voices, "ready");
    assert.deepEqual(requests, [undefined, `bytes=${Math.floor(pack.length / 2)}-`]);
    assert.equal((await voices.read("ryan", "0000000000000001")).toString(), "first");
    assert.equal((await voices.read("sonia", "0000000000000002")).toString(), "second");
    assert.equal(await voices.read("ryan", "0000000000000002"), null);
    voices.dispose();

    // A verified pack opens without downloading again.
    const again = createVoicePack({ dir, manifest, fetchImpl: () => assert.fail("downloaded again") });
    again.start();
    await waitFor(again, "ready");
    again.dispose();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Voice pack rejects a damaged download and keeps the system voice", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "voice-pack-"));
  try {
    const { pack, manifest } = makePack({ "ryan/0000000000000001": "first" });
    const damaged = Buffer.from(pack);
    damaged[damaged.length - 1] ^= 1;
    const fetchImpl = async () => ({ ok: true, status: 200, body: (async function* () { yield damaged; })() });
    const voices = createVoicePack({ dir, manifest, fetchImpl, retryDelays: [60_000] });
    voices.start();
    await waitFor(voices, "error");
    assert.equal(await voices.read("ryan", "0000000000000001"), null);
    voices.dispose();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
