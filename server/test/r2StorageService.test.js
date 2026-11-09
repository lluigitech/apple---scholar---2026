const test = require('node:test');
const assert = require('node:assert/strict');
const r2Storage = require('../services/r2StorageService');

test('R2 references round-trip encoded object keys', () => {
    const uri = r2Storage.makeR2Uri('scholar-files', 'apple-scholar/report-cards/Student 1.pdf');

    assert.equal(uri, 'r2://scholar-files/apple-scholar/report-cards/Student%201.pdf');
    assert.deepEqual(r2Storage.parseR2Uri(uri), {
        bucket: 'scholar-files',
        key: 'apple-scholar/report-cards/Student 1.pdf',
    });
});

test('R2 references reject malformed encoding and unsafe path segments', () => {
    assert.throws(() => r2Storage.parseR2Uri('r2://scholar-files/folder/%E0%A4%A'), /Invalid R2 object reference/);
    assert.throws(() => r2Storage.parseR2Uri('r2://scholar-files/folder/%2E%2E/file.pdf'), /Invalid R2 object reference/);
    assert.throws(() => r2Storage.parseR2Uri('r2://scholar-files/folder/file.pdf?download=1'), /Invalid R2 object reference/);
});

test('R2 object keys use a sanitized category and original filename', () => {
    const key = r2Storage.createObjectKey({
        folder: 'report-cards',
        scholarId: 'scholar/123',
        originalName: 'First Semester Report Card.PDF',
    });

    assert.match(key, /^apple-scholar\/report-cards\/scholar-123\/[0-9a-f-]+-First-Semester-Report-Card\.pdf$/);
});

test('R2 configuration requires an account-level HTTPS endpoint', () => {
    const originalConfig = {
        endpoint: process.env.R2_ENDPOINT,
        bucket: process.env.R2_BUCKET_NAME,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    };

    try {
        process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com/bucket';
        process.env.R2_BUCKET_NAME = 'scholar-files';
        process.env.R2_ACCESS_KEY_ID = 'test-key';
        process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
        assert.throws(() => r2Storage.getR2Config(), /account-level HTTPS endpoint/);

        process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
        assert.deepEqual(r2Storage.getR2Config(), {
            endpoint: 'https://account.r2.cloudflarestorage.com',
            bucket: 'scholar-files',
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret',
        });
    } finally {
        for (const [key, value] of Object.entries({
            R2_ENDPOINT: originalConfig.endpoint,
            R2_BUCKET_NAME: originalConfig.bucket,
            R2_ACCESS_KEY_ID: originalConfig.accessKeyId,
            R2_SECRET_ACCESS_KEY: originalConfig.secretAccessKey,
        })) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});