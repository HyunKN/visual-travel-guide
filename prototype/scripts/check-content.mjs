import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateContent } from '../src/content.js';

const contentUrl = new URL('../../docs/prototype/content/content.json', import.meta.url);
const data = JSON.parse(await readFile(contentUrl, 'utf8'));
const errors = validateContent(data);

function jpegSize(bytes) {
  if (bytes.readUInt16BE(0) !== 0xffd8) throw new Error('JPEG 형식 아님');
  let offset = 2;
  while (offset < bytes.length - 8) {
    if (bytes[offset++] !== 0xff) continue;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    offset += length;
  }
  throw new Error('사진 크기를 읽지 못함');
}

function imageSize(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') return jpegSize(bytes);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunk = bytes.toString('ascii', offset, offset + 4), length = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (start + length > bytes.length) break;
    if (chunk === 'VP8X') return { width: bytes.readUIntLE(start + 4, 3) + 1, height: bytes.readUIntLE(start + 7, 3) + 1 };
    if (chunk === 'VP8 ' && bytes.toString('hex', start + 3, start + 6) === '9d012a') return { width: bytes.readUInt16LE(start + 6) & 0x3fff, height: bytes.readUInt16LE(start + 8) & 0x3fff };
    if (chunk === 'VP8L' && bytes[start] === 0x2f) {
      const bits = bytes.readUInt32LE(start + 1);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    offset = start + length + (length % 2);
  }
  throw new Error('WebP 크기를 읽지 못함');
}

for (const asset of data.assets) {
  try {
    const bytes = await readFile(new URL(asset.localPath, contentUrl));
    const size = imageSize(bytes);
    if (size.width !== asset.width || size.height !== asset.height) errors.push(`${asset.id}: 실제 사진 크기 불일치`);
    if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) errors.push(`${asset.id}: 사진 해시 불일치`);
  } catch (error) { errors.push(`${asset.id}: ${error.message}`); }
}

if (data.answers.some((answer) => answer.reviewStatus !== 'reviewed')) errors.push('관찰용 자료에 미검수 답변 포함');
for (const key of ['comparisonCases', 'continuations']) if (data[key]?.some((item) => item.reviewStatus !== 'reviewed')) errors.push(`${key}: 관찰용 자료 미검수`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`콘텐츠 검사 통과: ${data.scenes.length} 장면, ${data.targets.length} 대상, ${data.answers.length} 검수 답변, ${data.assets.length} 사진 · ${data.contentVersion}`);
}
