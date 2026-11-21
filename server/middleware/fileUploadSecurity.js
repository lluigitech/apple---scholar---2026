const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const net = require('node:net');

const SCAN_CHUNK_SIZE = 64 * 1024;
const SCAN_TIMEOUT_MS = 120_000;

const isJpeg = buffer => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
const isPng = buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const isPdf = buffer => buffer.subarray(0, 5).toString('ascii') === '%PDF-';
const isOleDocument = buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
const isZip = buffer => buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;

const hasValidFileSignature = (file) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const buffer = file.buffer;
    if (!buffer) return false;
    if (['.jpg', '.jpeg'].includes(extension)) return isJpeg(buffer);
    if (extension === '.png') return isPng(buffer);
    if (extension === '.pdf') return isPdf(buffer);
    if (extension === '.doc') return isOleDocument(buffer);
    if (extension === '.docx') return isZip(buffer);
    return false;
};

const validateUploadedFileSignatures = (req, res, next) => {
    const files = req.file ? [req.file] : Object.values(req.files || {}).flat();
    if (files.every(hasValidFileSignature)) return next();
    return res.status(400).json({ error: 'Uploaded file content does not match its declared file type' });
};

const getClamScanPath = (platform = process.platform) =>
    process.env.CLAMSCAN_PATH || (platform === 'win32'
        ? 'C:\\ClamAV\\clamscan.exe'
        : '/usr/bin/clamscan');
const getClamDbDir = (platform = process.platform) =>
    process.env.CLAMAV_DB_DIR || (platform === 'win32'
        ? 'C:\\ClamAV\\db'
        : '/var/lib/clamav');

const scannerUnavailable = (error) => Object.assign(
    new Error(`ClamAV scanner is unavailable: ${error.message || error}`),
    { statusCode: 503 },
);

const scanWithClamd = (buffer) => new Promise((resolve, reject) => {
    const host = process.env.CLAMAV_HOST || '127.0.0.1';
    const port = Number(process.env.CLAMAV_PORT || 3310);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        reject(scannerUnavailable('invalid CLAMAV_PORT'));
        return;
    }

    const socket = net.createConnection({ host, port });
    let response = Buffer.alloc(0);
    let settled = false;
    const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        socket.destroy();
        callback(value);
    };
    const fail = error => finish(reject, scannerUnavailable(error));
    const timeout = setTimeout(
        () => fail(new Error('scan timed out')),
        SCAN_TIMEOUT_MS,
    );

    socket.once('connect', () => {
        socket.write(Buffer.from('zINSTREAM\0'));
        let offset = 0;
        const writeNextChunk = () => {
            if (settled) return;
            if (offset >= buffer.length) {
                socket.write(Buffer.alloc(4));
                return;
            }

            const chunk = buffer.subarray(offset, offset + SCAN_CHUNK_SIZE);
            offset += chunk.length;
            const length = Buffer.alloc(4);
            length.writeUInt32BE(chunk.length, 0);
            socket.write(length, () => socket.write(chunk, writeNextChunk));
        };
        writeNextChunk();
    });

    socket.on('data', chunk => {
        response = Buffer.concat([response, chunk]);
        if (response.length > 4096) {
            fail(new Error('scanner returned an oversized response'));
            return;
        }

        const terminator = response.indexOf(0);
        if (terminator < 0) return;
        const detail = response.subarray(0, terminator).toString('utf8').trim();
        if (detail.endsWith('OK')) {
            finish(resolve, { clean: true, detail });
        } else if (/\bFOUND\b/.test(detail)) {
            finish(resolve, { clean: false, infected: true, detail });
        } else {
            fail(new Error(detail || 'scanner returned an invalid response'));
        }
    });
    socket.once('error', fail);
    socket.once('close', () => {
        if (!settled) fail(new Error('scanner connection closed before returning a result'));
    });
});

const scanWithClamScan = (buffer) => new Promise((resolve, reject) => {
    const temporaryPath = path.join(os.tmpdir(), `apple-scholar-scan-${crypto.randomUUID()}.bin`);
    let scanner;
    const output = [];
    let settled = false;
    const finish = async (callback, value) => {
        if (settled) return;
        settled = true;
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
        callback(value);
    };

    fs.writeFile(temporaryPath, buffer).then(() => {
        const scannerArgs = ['--database=' + getClamDbDir(), '--no-summary', temporaryPath];
        scanner = spawn(getClamScanPath(), scannerArgs, { windowsHide: true });
        scanner.stdout.on('data', chunk => output.push(chunk.toString()));
        scanner.stderr.on('data', chunk => output.push(chunk.toString()));
        scanner.on('error', error => finish(reject, scannerUnavailable(error)));
        scanner.on('close', code => {
        if (code === 0) return finish(resolve, { clean: true, detail: output.join('').trim() });
        if (code === 1) return finish(resolve, { clean: false, infected: true, detail: output.join('').trim() });
        return finish(reject, scannerUnavailable(
            new Error(`ClamAV exited with code ${code}: ${output.join('').trim()}`),
        ));
        });
    }).catch(error => finish(reject, error));
});

const scanBuffer = (buffer) => process.env.CLAMAV_HOST
    ? scanWithClamd(buffer)
    : scanWithClamScan(buffer);

const scanUploadedFiles = async (req, res, next) => {
    const files = req.file ? [req.file] : Object.values(req.files || {}).flat();
    if (!files.length) return next();

    try {
        for (const file of files) {
            const result = await scanBuffer(file.buffer);
            if (!result.clean) {
                console.warn('[ClamAV] Infected upload rejected:', file.originalname, result.detail);
                return res.status(400).json({ error: 'Uploaded file failed the malware scan and was rejected.' });
            }
        }
        return next();
    } catch (error) {
        console.error('[ClamAV] Scanner unavailable:', error.message);
        return res.status(503).json({ error: 'Malware scanner is unavailable. The upload was not accepted.' });
    }
};

module.exports = {
    hasValidFileSignature,
    validateUploadedFileSignatures,
    scanUploadedFiles,
    scanBuffer,
    getClamScanPath,
    getClamDbDir,
};