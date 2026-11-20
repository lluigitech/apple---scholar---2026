const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { normalizeToPng } = require('../services/imageBufferService');

test('normalizes JPEG image bytes to PNG for DOCX embedding', async () => {
  const jpeg = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 40, g: 100, b: 180 },
    },
  }).jpeg().toBuffer();

  const png = await normalizeToPng(jpeg);
  const metadata = await sharp(png).metadata();

  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 2);
  assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
});

test('rejects invalid image bytes instead of embedding them as PNG', async () => {
  await assert.rejects(normalizeToPng(Buffer.from('not an image')));
});
