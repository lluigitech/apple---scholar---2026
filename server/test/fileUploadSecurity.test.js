const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const {
    getClamScanPath,
    getClamDbDir,
    scanBuffer,
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

const withFakeClamd = async (response, callback) => {
    let requestBuffer = Buffer.alloc(0);
    let scanResult;
    const server = net.createServer(socket => {
        socket.on('data', chunk => {
            requestBuffer = Buffer.concat([requestBuffer, chunk]);
            const command = Buffer.from('zINSTREAM\0');
            if (requestBuffer.length < command.length || scanResult) return;
            if (!requestBuffer.subarray(0, command.length).equals(command)) {
                socket.destroy();
                return;
            }

            let offset = command.length;
            const chunks = [];
            while (offset + 4 <= requestBuffer.length) {
                const length = requestBuffer.readUInt32BE(offset);
                offset += 4;
                if (length === 0) {
                    scanResult = Buffer.concat(chunks);
                    socket.end(`${response}\0`);
                    return;
                }
                if (offset + length > requestBuffer.length) return;
                chunks.push(requestBuffer.subarray(offset, offset + length));
                offset += length;
            }
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

    const previousHost = process.env.CLAMAV_HOST;
    const previousPort = process.env.CLAMAV_PORT;
    process.env.CLAMAV_HOST = '127.0.0.1';
    process.env.CLAMAV_PORT = String(server.address().port);
    try {
        return await callback(() => scanResult);
    } finally {
        if (previousHost === undefined) delete process.env.CLAMAV_HOST;
        else process.env.CLAMAV_HOST = previousHost;
        if (previousPort === undefined) delete process.env.CLAMAV_PORT;
        else process.env.CLAMAV_PORT = previousPort;
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
};

test('streams upload bytes to the persistent ClamAV daemon', async () => {
    const content = Buffer.alloc(150_000, 0x41);
    await withFakeClamd('stream: OK', async getScanResult => {
        const result = await scanBuffer(content);
        assert.deepEqual(result, { clean: true, detail: 'stream: OK' });
        assert.deepEqual(getScanResult(), content);
    });
});

test('reports infected files from the persistent ClamAV daemon', async () => {
    await withFakeClamd('stream: Eicar-Test-Signature FOUND', async () => {
        const result = await scanBuffer(Buffer.from('sample'));
        assert.equal(result.clean, false);
        assert.equal(result.infected, true);
    });
});

test('fails closed when the persistent ClamAV daemon returns an error', async () => {
    await withFakeClamd('INSTREAM size limit exceeded. ERROR', async () => {
        await assert.rejects(scanBuffer(Buffer.from('sample')), error => error.statusCode === 503);
    });
});
