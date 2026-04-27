// Client-side tar.gz entry lister.
//
// Reads filenames from a tar.gz File in the browser without extracting content
// or uploading the whole archive. Uses the native DecompressionStream
// (Chrome 80+, Firefox 113+, Safari 16+) and a chunk queue to keep buffer
// operations O(n) instead of O(n²).
//
// For Amarisoft 2026-04-22 (~95 MB, 543 entries) this completes in about
// 3-5 seconds. We also:
//   • Abort early once we've entered the doc/ subdirectory (nothing we care
//     about lives beyond that point in any Amarisoft release).
//   • Cap the total entry count so pathological archives can't hang the tab.
//   • Report progress via the optional onProgress callback.

const BLOCK_SIZE = 512;
const HEADER_NAME_LEN = 100;
const HEADER_PREFIX_OFFSET = 345;
const HEADER_PREFIX_LEN = 155;
const HEADER_SIZE_OFFSET = 124;
const HEADER_SIZE_LEN = 12;
const HEADER_TYPE_OFFSET = 156;
const MAX_ENTRIES = 2000;
const EARLY_STOP_MARKER = '/doc/';   // Everything after this is documentation

function readCString(buf: Uint8Array, start: number, len: number): string {
  let end = start;
  const max = start + len;
  while (end < max && buf[end] !== 0) end++;
  return new TextDecoder('ascii').decode(buf.subarray(start, end));
}

function readOctal(buf: Uint8Array, start: number, len: number): number {
  const str = readCString(buf, start, len).trim();
  if (!str) return 0;
  return parseInt(str, 8) || 0;
}

/**
 * Chunk queue — holds decompressed stream chunks and serves byte ranges
 * without ever concatenating into one big array. All operations are O(n)
 * over total bytes consumed.
 */
class ChunkQueue {
  private chunks: Uint8Array[] = [];
  private total = 0;
  private offset = 0;  // bytes consumed from chunks[0]

  push(chunk: Uint8Array) {
    if (chunk.length > 0) {
      this.chunks.push(chunk);
      this.total += chunk.length;
    }
  }

  available(): number {
    return this.total - this.offset;
  }

  /** Return the next `len` bytes as a contiguous Uint8Array. Consumes them. */
  take(len: number): Uint8Array {
    if (len === 0) return new Uint8Array(0);
    const head = this.chunks[0];
    const remainingInHead = head.length - this.offset;
    // Fast path: entire range lies inside the head chunk
    if (len <= remainingInHead) {
      const view = head.subarray(this.offset, this.offset + len);
      this.offset += len;
      this.total -= len;
      if (this.offset === head.length) {
        this.chunks.shift();
        this.offset = 0;
      }
      return view;
    }
    // Slow path: spans multiple chunks — allocate exactly once
    const out = new Uint8Array(len);
    let written = 0;
    while (written < len) {
      const cur = this.chunks[0];
      const start = this.offset;
      const copy = Math.min(cur.length - start, len - written);
      out.set(cur.subarray(start, start + copy), written);
      written += copy;
      this.offset += copy;
      this.total -= copy;
      if (this.offset === cur.length) {
        this.chunks.shift();
        this.offset = 0;
      }
    }
    return out;
  }

  /** Discard the next `len` bytes without allocating anything. */
  skip(len: number): void {
    while (len > 0) {
      const cur = this.chunks[0];
      if (!cur) return;
      const avail = cur.length - this.offset;
      if (len < avail) {
        this.offset += len;
        this.total -= len;
        return;
      }
      len -= avail;
      this.total -= avail;
      this.chunks.shift();
      this.offset = 0;
    }
  }
}

interface ListOptions {
  /** Abort parsing if it takes longer than this (default 60 s). */
  timeoutMs?: number;
  /** Called periodically with the current entry count. */
  onProgress?: (entryCount: number) => void;
}

/**
 * Stream-read tar.gz headers and return filenames.
 * Handles USTAR + GNU long-name (type 'L') + PAX extended (types 'x'/'g').
 */
export async function listTarGzEntries(file: File, opts: ListOptions = {}): Promise<string[]> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream not supported in this browser');
  }

  const timeoutMs = opts.timeoutMs ?? 60_000;
  const startTime = Date.now();

  const reader = file.stream()
    .pipeThrough(new DecompressionStream('gzip'))
    .getReader();

  const queue = new ChunkQueue();
  const entries: string[] = [];
  let pendingLongName: string | null = null;
  let lastProgressReport = 0;

  async function fill(minBytes: number): Promise<boolean> {
    while (queue.available() < minBytes) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Tar inspection timed out after ${timeoutMs / 1000}s`);
      }
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

      // End-of-archive marker: all-zero block
      let allZero = true;
      for (let i = 0; i < BLOCK_SIZE; i++) {
        if (header[i] !== 0) { allZero = false; break; }
      }
      if (allZero) break;

      const name     = readCString(header, 0, HEADER_NAME_LEN);
      const size     = readOctal(header, HEADER_SIZE_OFFSET, HEADER_SIZE_LEN);
      const typeFlag = String.fromCharCode(header[HEADER_TYPE_OFFSET] || 0);
      const prefix   = readCString(header, HEADER_PREFIX_OFFSET, HEADER_PREFIX_LEN);
      const padded   = Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;

      // GNU long-name: this entry's content IS the next regular entry's name
      if (typeFlag === 'L' || typeFlag === 'K') {
        if (!(await fill(padded))) break;
        const content = queue.take(size);
        queue.skip(padded - size);
        if (typeFlag === 'L') {
          pendingLongName = new TextDecoder('utf-8').decode(content).replace(/\0+$/, '');
        }
        continue;
      }

      // PAX extended headers — skip
      if (typeFlag === 'x' || typeFlag === 'g') {
        if (!(await fill(padded))) break;
        queue.skip(padded);
        continue;
      }

      const fullName = pendingLongName ?? (prefix ? `${prefix}/${name}` : name);
      pendingLongName = null;

      if (fullName) {
        entries.push(fullName);

        // Early-stop: once we're in the doc directory, nothing we care about
        // lives beyond. Abort decompression so the user gets a result in
        // seconds instead of minutes.
        if (fullName.includes(EARLY_STOP_MARKER)) {
          break;
        }

        if (opts.onProgress && entries.length - lastProgressReport >= 50) {
          lastProgressReport = entries.length;
          try { opts.onProgress(entries.length); } catch { /* swallow */ }
        }
      }

      // Skip this file's content blocks
      if (padded > 0) {
        if (!(await fill(padded))) break;
        queue.skip(padded);
      }
    }
  } finally {
    try { await reader.cancel(); } catch { /* stream may already be closed */ }
  }

  return entries;
}
