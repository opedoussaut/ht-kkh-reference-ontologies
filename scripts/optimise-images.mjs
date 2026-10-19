#!/usr/bin/env node
// Generate the responsive homepage background from a full-resolution source (kept outside the repository).
//   node scripts/optimise-images.mjs "<path to source.png>"
// Writes assets/images/atlas-background-{768,1280,2056}.webp and a JPEG fallback, and prints a size report.
import { statSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const src = process.argv[2];
if (!src) { console.error('Usage: node scripts/optimise-images.mjs <source.png>'); process.exit(1); }
const out = join(ROOT, 'assets/images');
mkdirSync(out, { recursive: true });

const meta = await sharp(src).metadata();
const kb = (p) => `${(statSync(p).size / 1024).toFixed(0)} KB`;
const report = [`source ${meta.width}×${meta.height} ${meta.format}: ${kb(src)}`];

for (const w of [768, 1280, 2056]) {
  const width = Math.min(w, meta.width);
  const p = join(out, `atlas-background-${w}.webp`);
  // Quality 80 with "smart subsample" keeps thin network lines and glows crisp on the dark navy background.
  await sharp(src).resize({ width }).webp({ quality: 80, smartSubsample: true, effort: 6 }).toFile(p);
  report.push(`webp ${width}w: ${kb(p)}`);
}
const jpg = join(out, 'atlas-background-1280.jpg');
await sharp(src).resize({ width: 1280 }).jpeg({ quality: 78, mozjpeg: true, progressive: true }).toFile(jpg);
report.push(`jpeg fallback 1280w: ${kb(jpg)}`);
console.log(report.join('\n'));
