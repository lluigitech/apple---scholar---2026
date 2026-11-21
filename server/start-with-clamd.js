const net = require('node:net');
const { spawn } = require('node:child_process');

const host = process.env.CLAMAV_HOST || '127.0.0.1';
const port = Number(process.env.CLAMAV_PORT || 3310);
const clamdPath = process.env.CLAMD_PATH || '/usr/sbin/clamd';
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const pingClamd = () => new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    let response = '';
    let settled = false;
    const finish = ready => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        socket.destroy();
        resolve(ready);
    };
    const timeout = setTimeout(() => finish(false), 1000);

    socket.once('connect', () => socket.write(Buffer.from('zPING\0')));
    socket.on('data', chunk => {
        response += chunk.toString('utf8');
        if (response.includes('PONG')) finish(true);
        else if (response.includes('\0')) finish(false);
    });
    socket.once('error', () => finish(false));
    socket.once('close', () => finish(response.includes('PONG')));
});

const clamd = spawn(clamdPath, [
    '--foreground',
    '--config-file=/etc/clamav/clamd.conf',
], { stdio: 'inherit' });

let clamdSpawnError = null;
let clamdExit = null;
let api = null;
let stopping = false;

clamd.on('error', error => {
    clamdSpawnError = error;
});
clamd.once('exit', (code, signal) => {
    clamdExit = { code, signal };
    if (stopping || !api || api.exitCode !== null) return;
    console.error(`[ClamAV] daemon exited unexpectedly (${signal || `code ${code}`}); stopping the API.`);
    api.kill('SIGTERM');
});

const stopChild = (child, signal) => {
    if (child && child.exitCode === null && child.signalCode === null) {
        child.kill(signal);
    }
};

const shutdown = signal => {
    if (stopping) return;
    stopping = true;
    stopChild(api, signal);
    stopChild(clamd, signal);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

const waitForClamd = async () => {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('CLAMAV_PORT must be a valid TCP port.');
    }

    const deadline = Date.now() + 120_000;
    while (!stopping && Date.now() < deadline) {
        if (clamdSpawnError) throw clamdSpawnError;
        if (clamdExit || clamd.exitCode !== null) {
            const reason = clamdExit?.signal || `code ${clamdExit?.code ?? clamd.exitCode}`;
            throw new Error(`clamd exited before becoming ready (${reason}).`);
        }
        if (await pingClamd()) return;
        await delay(500);
    }
    throw new Error(stopping
        ? 'Startup was interrupted before clamd became ready.'
        : 'clamd did not become ready within 120 seconds.');
};

const start = async () => {
    try {
        await waitForClamd();
        if (stopping) return;
        if (clamdExit) {
            const reason = clamdExit.signal || `code ${clamdExit.code}`;
            throw new Error(`clamd exited before the API started (${reason}).`);
        }

        console.log('[ClamAV] daemon ready');
        api = spawn(process.execPath, ['server.js'], { stdio: 'inherit' });
        api.once('error', error => {
            console.error('[server] failed to start:', error.message);
            shutdown('SIGTERM');
            process.exitCode = 1;
        });
        api.once('exit', code => {
            stopping = true;
            stopChild(clamd, 'SIGTERM');
            process.exitCode = Number.isInteger(code) ? code : 1;
        });
    } catch (error) {
        console.error('[ClamAV] daemon startup failed:', error.message);
        stopping = true;
        stopChild(clamd, 'SIGTERM');
        process.exitCode = 1;
    }
};

start();
