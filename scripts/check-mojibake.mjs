import fs from 'node:fs';
import path from 'node:path';

// Mojibake = UTF-8 bytes that were decoded with the wrong charset and re-saved.
// Detect it exactly: re-encode a candidate run back to its original bytes
// (CP1252/Latin-1) and check whether those bytes decode as valid UTF-8 into
// different text. Legitimate Vietnamese never survives that round-trip.
const CP1252_HIGH = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…',
  0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š',
  0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’',
  0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ',
  0x9e: 'ž', 0x9f: 'Ÿ',
};

const BYTE_OF = new Map();
for (let b = 0; b <= 0xff; b++) {
  const ch = b >= 0x80 && b <= 0x9f ? (CP1252_HIGH[b] ?? String.fromCharCode(b)) : String.fromCharCode(b);
  if (!BYTE_OF.has(ch)) BYTE_OF.set(ch, b);
}

const decoder = new TextDecoder('utf-8', { fatal: true });

// A run is a maximal sequence of chars that each map back to a single byte.
function* runs(line) {
  let buf = [];
  for (const ch of line) {
    if (BYTE_OF.has(ch)) {
      buf.push(ch);
    } else {
      if (buf.length) yield buf;
      buf = [];
    }
  }
  if (buf.length) yield buf;
}

function isMojibake(line) {
  if (line.includes('\uFFFD')) return true;
  for (const run of runs(line)) {
    if (run.length < 2) continue;
    const bytes = Uint8Array.from(run, (ch) => BYTE_OF.get(ch));
    let decoded;
    try {
      decoded = decoder.decode(bytes);
    } catch {
      continue; // not valid UTF-8 → legitimately Latin-1 text
    }
    if (decoded !== run.join('')) return true;
  }
  return false;
}

const SKIP = new Set(['node_modules', 'dist', '.git', '.vite']);
const EXT = /\.(ts|tsx|js|jsx|json|html|css|md)$/;

let hits = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (EXT.test(entry.name)) {
      const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        if (isMojibake(line)) {
          hits++;
          console.log(`${full.replace(/\\/g, '/')}:${i + 1}: ${line.trim().slice(0, 120)}`);
        }
      });
    }
  }
}
walk(process.argv[2] ?? '.');
console.log(hits === 0 ? 'OK: no mojibake' : `FOUND ${hits}`);
