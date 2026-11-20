const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const PizZip = require('pizzip');

const dbPath = require.resolve('../config/db');
const cloudinaryPath = require.resolve('../config/cloudinary');
const r2Path = require.resolve('../services/r2StorageService');
const generatorPath = require.resolve('../services/letterPdfGenerator');

test('embeds R2 JPEG media as PNG and omits unavailable photo tags', async () => {
  const jpeg = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 40, g: 100, b: 180 },
    },
  }).jpeg().toBuffer();

  let mediaFilePath = 'r2://test-bucket/photo';
  let signedDownload;
  const db = {
    promise: () => ({
      query: async (sql) => {
        if (sql.includes('FROM submissions s')) {
          return [[{
            id: 7,
            letter_content: 'Test letter',
            submitted_at: new Date('2026-01-01T00:00:00Z'),
            report_card_path: null,
            cor_path: null,
            generated_pdf_path: null,
            scholar_id: 'test-scholar',
          }]];
        }
        if (sql.includes('FROM users')) {
          return [[{
            full_name: 'Test Scholar',
            age: 20,
            year_level: 'college 1',
            course: 'Test course',
            track_strand: '',
            school: 'Test school',
          }]];
        }
        if (sql.includes('FROM submission_media')) {
          return [[{
            file_path: mediaFilePath,
            photo_path: mediaFilePath,
            description: 'Photo',
          }]];
        }
        if (sql.includes('FROM file_assets')) {
          return [[{
            public_id: 'test/photo',
            resource_type: 'image',
            file_format: 'jpg',
          }]];
        }
        throw new Error(`Unexpected query: ${sql}`);
      },
    }),
  };
  const cloudinary = {
    utils: {
      private_download_url: (publicId, extension, options) => {
        signedDownload = { publicId, extension, options };
        return 'https://signed.example/photo';
      },
    },
  };
  let r2ReadCount = 0;
  const r2Storage = {
    parseR2Uri: (uri) => uri.startsWith('r2://') ? { bucket: 'test-bucket', key: 'photo' } : null,
    readObjectBuffer: async () => {
      r2ReadCount += 1;
      return jpeg;
    },
  };

  const previousModules = new Map([
    [dbPath, require.cache[dbPath]],
    [cloudinaryPath, require.cache[cloudinaryPath]],
    [r2Path, require.cache[r2Path]],
  ]);
  const replaceModule = (modulePath, exports) => {
    require.cache[modulePath] = {
      id: modulePath,
      filename: modulePath,
      loaded: true,
      exports,
    };
  };
  replaceModule(dbPath, db);
  replaceModule(cloudinaryPath, cloudinary);
  replaceModule(r2Path, r2Storage);
  delete require.cache[generatorPath];

  const originalFetch = global.fetch;
  let fetchedUrl;
  global.fetch = async (url) => {
    fetchedUrl = url;
    return {
      ok: true,
      arrayBuffer: async () => jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength),
    };
  };

  try {
    const generator = require('../services/letterPdfGenerator');
    const docx = await generator.generateLetterDocx(7);
    assert.equal(r2ReadCount, 1);
    const zip = new PizZip(docx);
    const mediaPaths = Object.keys(zip.files).filter((filePath) => filePath.includes('image_generated_'));
    assert.equal(mediaPaths.length, 1, Object.keys(zip.files).join(', '));
    assert.deepEqual(
      zip.file(mediaPaths[0]).asNodeBuffer().subarray(0, 8),
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );

    const documentXml = zip.file('word/document.xml').asText();
    assert.doesNotMatch(documentXml, /photo[12]/);

    mediaFilePath = 'https://res.cloudinary.com/demo/image/authenticated/photo.jpg';
    const cloudinaryDocx = await generator.generateLetterDocx(7);
    const cloudinaryZip = new PizZip(cloudinaryDocx);
    const cloudinaryImagePath = Object.keys(cloudinaryZip.files)
      .find((filePath) => filePath.includes('image_generated_'));
    assert.ok(cloudinaryImagePath);
    assert.deepEqual(
      cloudinaryZip.file(cloudinaryImagePath).asNodeBuffer().subarray(0, 8),
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
    assert.equal(fetchedUrl, 'https://signed.example/photo');
    assert.equal(signedDownload.publicId, 'test/photo');
    assert.equal(signedDownload.options.type, 'authenticated');
  } finally {
    global.fetch = originalFetch;
    delete require.cache[generatorPath];
    for (const [modulePath, previousModule] of previousModules) {
      if (previousModule) require.cache[modulePath] = previousModule;
      else delete require.cache[modulePath];
    }
  }
});
