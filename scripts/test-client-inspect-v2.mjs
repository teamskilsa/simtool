// Benchmark the new chunk-queue parser vs the old O(n^2) approach.
import { createReadStream, statSync } from 'node:fs';
import { Readable } from 'node:stream';

const PATH = 'C:/Users/Simnovus-Lab/Downloads/amarisoft.2026-04-22.tar.gz';
const BLOCK_SIZE = 512;
const HEADER_NAME_LEN = 100;
const HEADER_PREFIX_OFFSET = 345;
const HEADER_PREFIX_LEN = 155;
const HEADER_SIZE_OFFSET = 124;
const HEADER_SIZE_LEN = 12;
const HEADER_TYPE_OFFSET = 156;
const MAX_ENTRIES = 2000;
const EARLY_STOP_MARKER = '/doc/';

function readCString(buf, start, len) {
  let end = start;
  const max = start + len;
  while (end < max && buf[end] !== 0) end++;
  return new TextDecoder('ascii').decode(buf.subarray(start, end));
}
function readOctal(buf, start, len) {
  const str = readCString(buf, start, len).trim();
  if (!str) return 0;
  return parseInt(str, 8) || 0;
}

class ChunkQueue {
  constructor() { this.chunks = []; this.total = 0; this.offset = 0; }
  push(c) { if (c.length) { this.chunks.push(c); this.total += c.length; } }
  available() { return this.total - this.offset; }
  take(len) {
    if (len === 0) return new Uint8Array(0);
    const head = this.chunks[0];
    const remaining = head.length - this.offset;
    if (len <= remaining) {
      const view = head.subarray(this.offset, this.offset + len);
      this.offset += len; this.total -= len;
      if (this.offset === head.length) { this.chunks.shift(); this.offset = 0; }
      return view;
    }
    const out = new Uint8Array(len);
    let written = 0;
    while (written < len) {
      const cur = this.chunks[0];
      const start = this.offset;
      const copy = Math.min(cur.length - start, len - written);
      out.set(cur.subarray(start, start + copy), written);
      written += copy; this.offset += copy; this.total -= copy;
      if (this.offset === cur.length) { this.chunks.shift(); this.offset = 0; }
    }
    return out;
  }
  skip(len) {
    while (len > 0) {
      const cur = this.chunks[0];
      if (!cur) return;
      const avail = cur.length - this.offset;
      if (len < avail) { this.offset += len; this.total -= len; return; }
      len -= avail; this.total -= avail;
      this.chunks.shift(); this.offset = 0;
    }
  }
}

async function listTarGzEntries(webStream) {
  const reader = webStream.pipeThrough(new DecompressionStream('gzip')).getReader();
  const queue = new ChunkQueue();
  const entries = [];
  let pendingLongName = null;

  async function fill(minBytes) {
    while (queue.available() < minBytes) {
      const { value, done } = await reader.read();
      if (done) return false;
      if (value) queue.push(value);
    }
    return true;
  }

  try {
    while (entries.length < MAX_ENTRIES) {
      if (!(await fill(BLOCK_SIZE))) break;
      const header = queue.take(BLOCK_SIZE);
      let allZero = true;
      for (let i = 0; i < BLOCK_SIZE; i++) if (header[i] !== 0) { allZero = false; break; }
      if (allZero) break;

      const name = readCString(header, 0, HEADER_NAME_LEN);
      const size = readOctal(header, HEADER_SIZE_OFFSET, HEADER_SIZE_LEN);
      const typeFlag = String.fromCharCode(header[HEADER_TYPE_OFFSET] || 0);
      const prefix = readCString(header, HEADER_PREFIX_OFFSET, HEADER_PREFIX_LEN);
      const padded = Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;

      if (typeFlag === 'L' || typeFlag === 'K') {
        if (!(await fill(padded))) break;
        const content = queue.take(size);
        queue.skip(padded - size);
        if (typeFlag === 'L') pendingLongName = new TextDecoder('utf-8').decode(content).replace(/\0+$/, '');
        continue;
      }
      if (typeFlag === 'x' || typeFlag === 'g') {
        if (!(await fill(padded))) break;
        queue.skip(padded);
        continue;
      }
      const fullName = pendingLongName ?? (prefix ? `${prefix}/${name}` : name);
      pendingLongName = null;
      if (fullName) {
        entries.push(fullName);
        if (fullName.includes(EARLY_STOP_MARKER)) break;
      }
      if (padded > 0) {
        if (!(await fill(padded))) break;
        queue.skip(padded);
      }
    }
  } finally {
    try { await reader.cancel(); } catch {}
  }
  return entries;
}

const size = statSync(PATH).size;
console.log(`File: ${PATH}`);
console.log(`Size: ${(size / 1024 / 1024).toFixed(1)} MB`);

const start = Date.now();
const nodeStream = createReadStream(PATH);
const webStream = Readable.toWeb(nodeStream);
const entries = await listTarGzEntries(webStream);
const ms = Date.now() - start;

console.log(`\nParsed: ${entries.length} entries in ${ms} ms`);
console.log(`Last entry: ${entries[entries.length - 1]}`);

const hasInstall = entries.some(e => e.endsWith('/install.sh'));
const componentCount = entries.filter(e => /^2026-\d{2}-\d{2}\/lte[a-z]+(-[a-z0-9]+)?-[\d-]+\.tar\.gz$/.test(e)).length;
const trxCount = entries.filter(e => /\/trx_[a-z0-9]+(-[a-z0-9]+)?-[\d-]+\.tar\.gz$/.test(e)).length;
const licenseCount = entries.filter(e => /\/licenses\/.+\.key$/.test(e)).length;
console.log(`\nChecks:`);
console.log(`  install.sh found: ${hasInstall}`);
console.log(`  Component tars:   ${componentCount}`);
console.log(`  TRX drivers:      ${trxCount}`);
console.log(`  License files:    ${licenseCount}`);
