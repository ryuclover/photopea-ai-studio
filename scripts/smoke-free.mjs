// Explicit opt-in network test. Sends only generated color patches, never personal files.
import '../tests/register-ts.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { runSdxlQueue } from '../src/services/SdxlQueue.ts';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
function png(mask) {
  const size = 1024;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * (size * 4 + 1) + 1 + x * 4;
    const selected = x > 320 && x < 700 && y > 320 && y < 700;
    raw[i] = mask ? 255 : 80; raw[i + 1] = mask ? 255 : 140; raw[i + 2] = mask ? 255 : 180;
    raw[i + 3] = mask ? (selected ? 255 : 0) : 255;
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return new Blob([Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR', header),chunk('IDAT', deflateSync(raw)),chunk('IEND', Buffer.alloc(0))])], {type:'image/png'});
}
// Transport-only smoke: canvas preprocessing is tested in the browser.
mkdirSync('test-results', {recursive:true});
writeFileSync('test-results/mask.png', Buffer.from(await png(true).arrayBuffer()));
writeFileSync('test-results/base.png', Buffer.from(await png(false).arrayBuffer()));
console.log('Enviando apenas imagem sintética e máscara ao SDXL público...');
try {
  const signal = AbortSignal.timeout(180000);
  const url = await runSdxlQueue(png(false), png(true),
    'a red ceramic sphere on a blue background, studio product photography',
    'blurry, distorted', 24, 7.5, signal, process.env.HF_TOKEN, console.log);
  const response = await fetch(url, {signal});
  if (!response.ok) throw new Error(`Download falhou: HTTP ${response.status}`);
  const result = {imageBlob: await response.blob()};
  if (!result.imageBlob.type.startsWith('image/')) throw new Error(`Resposta não é imagem: ${result.imageBlob.type}`);
  mkdirSync('test-results', {recursive:true});
  const extension = result.imageBlob.type === 'image/webp' ? 'webp' : result.imageBlob.type === 'image/jpeg' ? 'jpg' : 'png';
  const output = `test-results/sdxl-smoke.${extension}`;
  writeFileSync(output, Buffer.from(await result.imageBlob.arrayBuffer()));
  console.log(`OK: ${result.imageBlob.size} bytes; ${output}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
