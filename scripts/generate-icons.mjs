/**
 * Generate Pesto extension icons at 16, 32, 48, 128px.
 * Uses built-in Node.js to create minimal PNG files.
 *
 * The Pesto logo: two stacked rounded rectangles (green) on a pale green background.
 * For production-quality icons, replace with actual designed assets.
 */

import { writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'src', 'icons');
mkdirSync(outDir, { recursive: true });

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 for PNG
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
  }

  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function setPixel(pixels, width, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= width || y < 0) return;
  const idx = (y * width + x) * 4;
  if (idx < 0 || idx >= pixels.length) return;

  // Alpha blending
  if (a < 255 && pixels[idx + 3] > 0) {
    const srcA = a / 255;
    const dstA = pixels[idx + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    pixels[idx] = Math.round((r * srcA + pixels[idx] * dstA * (1 - srcA)) / outA);
    pixels[idx + 1] = Math.round((g * srcA + pixels[idx + 1] * dstA * (1 - srcA)) / outA);
    pixels[idx + 2] = Math.round((b * srcA + pixels[idx + 2] * dstA * (1 - srcA)) / outA);
    pixels[idx + 3] = Math.round(outA * 255);
  } else {
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = a;
  }
}

function fillRect(pixels, width, height, x, y, w, h, r, g, b, a = 255) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(pixels, width, Math.floor(x + dx), Math.floor(y + dy), r, g, b, a);
    }
  }
}

function fillRoundedRect(pixels, width, height, x, y, w, h, radius, r, g, b, a = 255) {
  // Fill the main body
  fillRect(pixels, width, height, x + radius, y, w - 2 * radius, h, r, g, b, a);
  fillRect(pixels, width, height, x, y + radius, w, h - 2 * radius, r, g, b, a);

  // Fill corners with anti-aliased circles
  const corners = [
    [x + radius, y + radius],
    [x + w - radius, y + radius],
    [x + radius, y + h - radius],
    [x + w - radius, y + h - radius],
  ];

  for (const [cx, cy] of corners) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          const aa = dist > radius - 1 ? Math.max(0, (radius - dist)) : 1;
          setPixel(pixels, width, Math.floor(cx + dx), Math.floor(cy + dy), r, g, b, Math.round(a * aa));
        }
      }
    }
  }
}

function drawPestoIcon(pixels, width, height) {
  // Background: pale green with rounded corners (matches Pesto Extension Icon.svg)
  const bgR = 0xF0, bgG = 0xF4, bgB = 0xE8;
  const fgR = 0x53, fgG = 0x87, fgB = 0x00;

  // SVG reference: 71x71, rx=13 → ~18.3% corner radius
  const cornerRadius = Math.round(width * 0.183);

  fillRoundedRect(pixels, width, height, 0, 0,
    width, height, cornerRadius, bgR, bgG, bgB);

  // SVG reference: top bar at x=20.5 y=14.5 w=30 h=19 rx=2 on 71x71 canvas
  const barRadius = Math.max(1, Math.round(width * (2 / 71)));

  // Top bar (wider)
  const topBarX = Math.round(width * (20.5 / 71));
  const topBarY = Math.round(height * (14.5 / 71));
  const topBarW = Math.round(width * (30 / 71));
  const topBarH = Math.round(height * (19 / 71));
  fillRoundedRect(pixels, width, height, topBarX, topBarY,
    topBarW, topBarH, barRadius, fgR, fgG, fgB);

  // Bottom bar (narrower) at x=20.5 y=37.5 w=16 h=19
  const botBarX = Math.round(width * (20.5 / 71));
  const botBarY = Math.round(height * (37.5 / 71));
  const botBarW = Math.round(width * (16 / 71));
  const botBarH = Math.round(height * (19 / 71));
  fillRoundedRect(pixels, width, height, botBarX, botBarY,
    botBarW, botBarH, barRadius, fgR, fgG, fgB);
}

async function createPNG(width, height, drawFn) {
  const pixels = new Uint8Array(width * height * 4);
  drawFn(pixels, width, height);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0);
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      rawData.push(pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]);
    }
  }

  const zlib = await import('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData));

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function generateAll() {
  const sizes = [16, 32, 48, 128];

  for (const size of sizes) {
    const png = await createPNG(size, size, drawPestoIcon);
    const path = resolve(outDir, `icon-${size}.png`);
    writeFileSync(path, png);
    console.log(`Generated ${path}`);
  }

  const distIconsDir = resolve(__dirname, '..', 'dist', 'icons');
  mkdirSync(distIconsDir, { recursive: true });

  for (const size of sizes) {
    const src = resolve(outDir, `icon-${size}.png`);
    const dst = resolve(distIconsDir, `icon-${size}.png`);
    copyFileSync(src, dst);
  }

  console.log('Icon generation complete.');
}

generateAll().catch(console.error);
