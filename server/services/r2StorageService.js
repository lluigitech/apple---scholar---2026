const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { GetObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const R2_URI_PREFIX = 'r2://';
let client;

const getR2Config = () => {
    const endpoint = process.env.R2_ENDPOINT;
    const bucket = process.env.R2_BUCKET_NAME;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
        throw new Error('R2 storage is selected but its endpoint, bucket, or credentials are not configured.');
    }

    const parsedEndpoint = new URL(endpoint);
    if (parsedEndpoint.protocol !== 'https:' || parsedEndpoint.username || parsedEndpoint.password ||
        parsedEndpoint.pathname !== '/' || parsedEndpoint.search || parsedEndpoint.hash) {
        throw new Error('R2_ENDPOINT must be an account-level HTTPS endpoint without credentials or a path.');
    }

    return {
        endpoint: `${parsedEndpoint.origin}`,
        bucket,
        accessKeyId,
        secretAccessKey,
    };
};

const getClient = () => {
    if (client) return client;
    const config = getR2Config();
    client = new S3Client({
        endpoint: config.endpoint,
        region: 'auto',
        forcePathStyle: true,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    });
    return client;
};

const getStorageProvider = () => {
    const provider = (process.env.FILE_STORAGE_PROVIDER || 'cloudinary').trim().toLowerCase();
    if (!['cloudinary', 'r2'].includes(provider)) {
        throw new Error(`Unsupported FILE_STORAGE_PROVIDER: ${provider}`);
    }
    return provider;
};

const encodeObjectKey = (key) => key.split('/').map(encodeURIComponent).join('/');

const makeR2Uri = (bucket, key) => `${R2_URI_PREFIX}${bucket}/${encodeObjectKey(key)}`;

const parseR2Uri = (uri) => {
    if (typeof uri !== 'string' || !uri.startsWith(R2_URI_PREFIX)) return null;
    let parsed;
    let key;
    try {
        const rawReference = uri.slice(R2_URI_PREFIX.length);
        const separatorIndex = rawReference.indexOf('/');
        if (separatorIndex < 1 || rawReference.includes('?') || rawReference.includes('#')) {
            throw new Error('Invalid R2 object reference.');
        }
        const rawSegments = rawReference.slice(separatorIndex + 1).split('/');
        const decodedSegments = rawSegments.map(decodeURIComponent);
        if (decodedSegments.some(part => !part || part === '.' || part === '..' || /[\/\\]/.test(part))) {
            throw new Error('Invalid R2 object reference.');
        }
        parsed = new URL(uri);
        key = decodedSegments.join('/');
    } catch {
        throw new Error('Invalid R2 object reference.');
    }
    const bucket = parsed.hostname;
    if (parsed.username || parsed.password || parsed.search || parsed.hash ||
        !bucket || !key || /[\u0000-\u001f\u007f]/.test(key) ||
        key.split('/').some(part => part === '.' || part === '..')) {
        throw new Error('Invalid R2 object reference.');
    }
    return { bucket, key };
};

const createObjectKey = ({ folder, scholarId, originalName }) => {
    const extension = path.extname(originalName || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
    const baseName = path.parse(originalName || 'upload').name
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .slice(0, 80) || 'upload';
    const safeScholarId = String(scholarId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '-');
    return `apple-scholar/${folder}/${safeScholarId}/${crypto.randomUUID()}-${baseName}${extension}`;
};

const uploadBuffer = async ({ buffer, key, contentType }) => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error('Cannot store an empty or invalid file buffer.');
    }
    const config = getR2Config();
    await getClient().send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream',
    }));
    return {
        url: makeR2Uri(config.bucket, key),
        key,
        bucket: config.bucket,
        resourceType: 'r2',
        format: path.extname(key).slice(1).toLowerCase() || 'bin',
    };
};

const uploadFile = async ({ filePath, key, contentType }) => {
    const buffer = await fs.readFile(filePath);
    return uploadBuffer({ buffer, key, contentType });
};

const getObject = async (uri) => {
    const reference = parseR2Uri(uri);
    if (!reference) throw new Error('Invalid R2 object reference.');
    const config = getR2Config();
    if (reference.bucket !== config.bucket) {
        throw new Error('R2 object reference points to an unconfigured bucket.');
    }
    return getClient().send(new GetObjectCommand({
        Bucket: config.bucket,
        Key: reference.key,
    }));
};

const readObjectBuffer = async (uri) => {
    const result = await getObject(uri);
    if (!result.Body) throw new Error('R2 returned an empty object body.');
    const chunks = [];
    for await (const chunk of result.Body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
};

module.exports = {
    R2_URI_PREFIX,
    createObjectKey,
    getObject,
    getR2Config,
    getStorageProvider,
    makeR2Uri,
    parseR2Uri,
    readObjectBuffer,
    uploadFile,
    uploadBuffer,
};
