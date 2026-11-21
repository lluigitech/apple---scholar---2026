const test = require('node:test');
const assert = require('node:assert/strict');
const {
    getClamScanPath,
    getClamDbDir,
} = require('../middleware/fileUploadSecurity');

test('uses Linux ClamAV paths by default on Render', () => {
    const previousScanPath = process.env.CLAMSCAN_PATH;
    const previousDbDir = process.env.CLAMAV_DB_DIR;
    delete process.env.CLAMSCAN_PATH;
    delete process.env.CLAMAV_DB_DIR;

    try {
        assert.equal(getClamScanPath('linux'), '/usr/bin/clamscan');
        assert.equal(getClamDbDir('linux'), '/var/lib/clamav');
    } finally {
        if (previousScanPath === undefined) delete process.env.CLAMSCAN_PATH;
        else process.env.CLAMSCAN_PATH = previousScanPath;
        if (previousDbDir === undefined) delete process.env.CLAMAV_DB_DIR;
        else process.env.CLAMAV_DB_DIR = previousDbDir;
    }
});

test('preserves explicit ClamAV environment overrides', () => {
    const previousScanPath = process.env.CLAMSCAN_PATH;
    const previousDbDir = process.env.CLAMAV_DB_DIR;
    process.env.CLAMSCAN_PATH = '/custom/clamscan';
    process.env.CLAMAV_DB_DIR = '/custom/clamdb';

    try {
        assert.equal(getClamScanPath('linux'), '/custom/clamscan');
        assert.equal(getClamDbDir('linux'), '/custom/clamdb');
    } finally {
        if (previousScanPath === undefined) delete process.env.CLAMSCAN_PATH;
        else process.env.CLAMSCAN_PATH = previousScanPath;
        if (previousDbDir === undefined) delete process.env.CLAMAV_DB_DIR;
        else process.env.CLAMAV_DB_DIR = previousDbDir;
    }
});
