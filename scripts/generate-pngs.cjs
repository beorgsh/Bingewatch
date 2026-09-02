const fs = require('fs');
const zlib = require('zlib');

// Minimal PNG generator in pure Node.js (no extra packages required)
function createPng(width, height, r, g, b, a = 255) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8 bits per channel
  ihdr.writeUInt8(6, 9); // RGBA color type
  ihdr.writeUInt8(0, 10); // Compression method
  ihdr.writeUInt8(0, 11); // Filter method
  ihdr.writeUInt8(0, 12); // Interlace method
  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw image data with filter byte 0 (None) per scanline
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter byte 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      
      // Draw border / background or logo pattern
      const isRedLogo = 
        (x > width * 0.25 && x < width * 0.45 && y > height * 0.2 && y < height * 0.8) ||
        (x > width * 0.45 && x < width * 0.65 && y > height * 0.2 && y < height * 0.5) ||
        (x > width * 0.45 && x < width * 0.7 && y > height * 0.5 && y < height * 0.8);
      const isWhitePlay = 
        (x >= width * 0.72 && x <= width * 0.85 && Math.abs(y - height * 0.5) <= (x - width * 0.72) * 0.8);

      if (isWhitePlay) {
        rawData[pixelOffset] = 255;
        rawData[pixelOffset + 1] = 255;
        rawData[pixelOffset + 2] = 255;
        rawData[pixelOffset + 3] = 255;
      } else if (isRedLogo) {
        rawData[pixelOffset] = 229; // #E50914 Netflix Red
        rawData[pixelOffset + 1] = 9;
        rawData[pixelOffset + 2] = 20;
        rawData[pixelOffset + 3] = 255;
      } else {
        rawData[pixelOffset] = r;
        rawData[pixelOffset + 1] = g;
        rawData[pixelOffset + 2] = b;
        rawData[pixelOffset + 3] = a;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(12 + length);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}

fs.writeFileSync('public/pwa-192x192.png', createPng(192, 192, 10, 10, 10));
fs.writeFileSync('public/pwa-512x512.png', createPng(512, 512, 10, 10, 10));
fs.writeFileSync('public/pwa-maskable-512x512.png', createPng(512, 512, 10, 10, 10));
fs.writeFileSync('public/apple-touch-icon.png', createPng(180, 180, 10, 10, 10));
fs.writeFileSync('public/favicon.ico', createPng(64, 64, 10, 10, 10));

console.log('Successfully generated all PWA PNG icons in /public!');
