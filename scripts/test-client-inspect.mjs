// Validate the client-side tar-gz entry reader against the real Amarisoft
// package. Runs in Node using a File-like stream (Node 18+ supports
// DecompressionStream and ReadableStream.from).
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
const MAX_ENTRIES = 5000;

function readCString(buf, start, len) {
  let end = start;
  const max = start + len;
  while (end < max && buf[end] !== 0) end++;
  return new TextDecoder('ascii').decode(buf.slice(start, end));
}
function readOctal(buf, start, len) {
  const str = readCString(buf, start, len).trim();
  if (!str) return 0;
  return parseInt(str, 8) || 0;
}

async function listTarGzEntries(webStream) {
  const reader = webStream
    .pipeThrough(new DecompressionStream('gzip'))
    .getReader();

  const entries = [];
  let buffer = new Uint8Array(0);
  let pendingLongName = null;

  async function fill(minBytes) {
    while (buffer.length < minBytes) {
      const { value, done } = await reader.read();
      if (done) return false;
      const merged = new Uint8Array(buffer.length + value.length);
      merged.set(buffer);
      merged.set(value, buffer.length);
      buffer = merged;
    }
    return true;
  }

  try {
    while (entries.length < MAX_ENTRIES) {
      if (!(await fill(BLOCK_SIZE))) break;
      const header = buffer.slice(0, BLOCK_SIZE);
      buffer = buffer.slice(BLOCK_SIZE);

      let allZero = true;
      for (let i = 0; i < BLOCK_SIZE; i++) {
        if (header[i] !== 0) { allZero = false; break; }
      }
      if (allZero) break;

      const name = readCString(header, 0, HEADER_NAME_LEN);
      const size = readOctal(header, HEADER_SIZE_OFFSET, HEADER_SIZE_LEN);
      const typeFlag = String.fromCharCode(header[HEADER_TYPE_OFFSET] || 0);
      const prefix = readCString(header, HEADER_PREFIX_OFFSET, HEADER_PREFIX_LEN);

      if (typeFlag === 'L' || typeFlag === 'K') {
        const contentLen = Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
        if (!(await fill(contentLen))) break;
        const content = buffer.slice(0, size);
        buffer = buffer.slice(contentLen);
        if (typeFlag === 'L') {
          pendingLongName = new TextDecoder('utf-8').decode(content).replace(/\0+$/, '');
        }
        continue;
      }
      if (typeFlag === 'x' || typeFlag === 'g') {
        const contentLen = Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
        if (!(await fill(contentLen))) break;
        buffer = buffer.slice(contentLen);
        continue;
      }

      const fullName = pendingLongName ?? (prefix ? `${prefix}/${name}` : name);
      pendingLongName = null;
      if (fullName) entries.push(fullName);

      const contentBlocks = Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
      if (contentBlocks > 0) {
        if (!(await fill(contentBlocks))) break;
        buffer = buffer.slice(contentBlocks);
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

console.log(`Parsed: ${entries.length} entries in ${ms} ms`);
console.log(`\nSample (first 5 + last 5):`);
for (const e of entries.slice(0, 5)) console.log(`  ${e}`);
console.log('  ...');
for (const e of entries.slice(-5)) console.log(`  ${e}`);

// Check key files
const hasInstall = entries.some(e => e.endsWith('/install.sh'));
const componentCount = entries.filter(e => /^2026-\d{2}-\d{2}\/lte[a-z]+(-[a-z0-9]+)?-[\d-]+\.tar\.gz$/.test(e)).length;
const licenseCount = entries.filter(e => /\/licenses\/.+\.key$/.test(e)).length;
console.log(`\nChecks:`);
console.log(`  install.sh found: ${hasInstall}`);
console.log(`  Component tars:   ${componentCount}`);
console.log(`  License files:    ${licenseCount}`);
