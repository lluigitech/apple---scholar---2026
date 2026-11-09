require('dotenv').config({ path: require('path').resolve(__dirname, '../utils/.env.aiven') });

const crypto = require('crypto');
const path = require('path');
const cloudinary = require('../config/cloudinary');
const db = require('../config/db');
const r2Storage = require('../services/r2StorageService');

const REFERENCE_COLUMNS = [
    { table: 'submissions', column: 'report_card_path', category: 'report-cards', alias: 's', join: 'FROM submissions s' },
    { table: 'submissions', column: 'cor_path', category: 'cor', alias: 's', join: 'FROM submissions s' },
    { table: 'submissions', column: 'generated_pdf_path', category: 'monthly-letters', alias: 's', join: 'FROM submissions s' },
    { table: 'grades', column: 'proof_path', category: 'report-cards', alias: 'g', join: 'FROM grades g' },
    { table: 'submission_media', column: 'file_path', category: 'other-documents', alias: 's', join: 'FROM submission_media m JOIN submissions s ON s.id = m.submission_id', mediaAlias: 'm' },
    { table: 'submission_media', column: 'photo_path', category: 'other-documents', alias: 's', join: 'FROM submission_media m JOIN submissions s ON s.id = m.submission_id', mediaAlias: 'm' },
    { table: 'documents', column: 'file_path', category: 'other-documents', alias: 'd', join: 'FROM documents d' },
    { table: 'file_assets', column: 'file_url', category: 'other-documents', alias: 'f', join: 'FROM file_assets f' },
];

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const sha256Text = (value) => crypto.createHash('sha256').update(value).digest('hex');
const contentTypeFor = (extension) => ({
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
})[extension] || 'application/octet-stream';

const extensionFor = (url, fileFormat) => {
    const candidate = fileFormat || path.extname(new URL(url).pathname).slice(1) || 'bin';
    const extension = String(candidate).toLowerCase().replace(/[^a-z0-9]/g, '');
    return extension || 'bin';
};

const validateCloudinaryUrl = (url) => {
    const parsed = new URL(url);
    const configuredCloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com' ||
        !configuredCloudName || parsed.pathname.split('/')[1] !== configuredCloudName) {
        throw new Error('A referenced Cloudinary file does not match the configured Cloudinary account.');
    }
    return parsed;
};

const fetchCloudinaryAsset = async (url, metadata) => {
    validateCloudinaryUrl(url);

    let downloadUrl = url;
    if (metadata?.public_id) {
        downloadUrl = cloudinary.utils.private_download_url(
            metadata.public_id,
            extensionFor(url, metadata.file_format),
            {
                resource_type: metadata.resource_type || 'image',
                type: 'authenticated',
                expires_at: Math.floor(Date.now() / 1000) + 600,
                attachment: false,
            }
        );
    }

    const response = await fetch(downloadUrl, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`Cloudinary download failed with HTTP ${response.status}.`);
    return Buffer.from(await response.arrayBuffer());
};

const getAssetFolder = (references, metadata) => {
    const publicId = metadata?.public_id || '';
    if (publicId.includes('generated-letters')) return 'monthly-letters';
    if (publicId.includes('report-cards')) return 'report-cards';
    if (publicId.includes('/cor/')) return 'cor';
    const reference = references.find(item => item.table !== 'file_assets');
    return reference?.category || 'other-documents';
};

const discoverReferences = async () => {
    const promiseDb = db.promise();
    const referencesByUrl = new Map();
    for (const reference of REFERENCE_COLUMNS) {
        const tableAlias = reference.mediaAlias || reference.alias;
        const fileColumn = reference.mediaAlias
            ? `${reference.mediaAlias}.\`${reference.column}\``
            : `${tableAlias}.\`${reference.column}\``;
        const [rows] = await promiseDb.query(
            `SELECT ${fileColumn} AS file_url, ${reference.alias}.scholar_id
             ${reference.join}
             WHERE ${fileColumn} IS NOT NULL AND ${fileColumn} <> ''`
        );
        for (const row of rows) {
            const fileUrl = row.file_url;
            if (typeof fileUrl !== 'string' || fileUrl.startsWith('r2://') ||
                fileUrl.startsWith('/uploads/') || fileUrl.startsWith('uploads/')) continue;
            if (!referencesByUrl.has(fileUrl)) referencesByUrl.set(fileUrl, []);
            referencesByUrl.get(fileUrl).push({ ...reference, scholarId: row.scholar_id });
        }
    }
    return referencesByUrl;
};

const getCloudinaryMetadata = async (fileUrl) => {
    const [rows] = await db.promise().query(
        'SELECT public_id, resource_type, file_format, scholar_id FROM file_assets WHERE file_url = ? LIMIT 1',
        [fileUrl]
    );
    return rows[0] || null;
};

const migrateOneFile = async (fileUrl, references, execute) => {
    const metadata = await getCloudinaryMetadata(fileUrl);
    validateCloudinaryUrl(fileUrl);
    const folder = getAssetFolder(references, metadata);
    if (!execute) return;

    const buffer = await fetchCloudinaryAsset(fileUrl, metadata);
    const digest = sha256(buffer);
    const extension = extensionFor(fileUrl, metadata?.file_format);
    const sourceId = sha256Text(fileUrl).slice(0, 20);
    const key = `apple-scholar/${folder}/${sourceId}-${digest}.${extension}`;
    const newUrl = r2Storage.makeR2Uri(process.env.R2_BUCKET_NAME, key);

    await r2Storage.uploadBuffer({
        buffer,
        key,
        contentType: contentTypeFor(extension),
    });
    const copiedBuffer = await r2Storage.readObjectBuffer(newUrl);
    if (sha256(copiedBuffer) !== digest) {
        throw new Error('R2 verification failed; the database reference was not changed.');
    }

    const promiseDb = db.promise();
    const connection = await promiseDb.getConnection();
    try {
        await connection.beginTransaction();
        for (const reference of references) {
            if (reference.table === 'file_assets') continue;
            await connection.query(
                `UPDATE \`${reference.table}\` SET \`${reference.column}\` = ? WHERE \`${reference.column}\` = ?`,
                [newUrl, fileUrl]
            );
        }
        const scholarId = metadata?.scholar_id || references.find(reference => reference.scholarId)?.scholarId;
        if (!scholarId) throw new Error('A referenced Cloudinary file is missing its scholar registration.');
        if (metadata) {
            await connection.query(
                `UPDATE file_assets
                 SET file_url = ?, public_id = ?, resource_type = 'r2', file_format = ?
                 WHERE file_url = ?`,
                [newUrl, key, extension, fileUrl]
            );
        } else {
            await connection.query(
                `INSERT INTO file_assets (scholar_id, file_url, public_id, resource_type, file_format)
                 VALUES (?, ?, ?, 'r2', ?)`,
                [scholarId, newUrl, key, extension]
            );
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
    return { migrated: true, newUrl };
};

const run = async () => {
    const execute = process.argv.includes('--execute');
    const provider = r2Storage.getStorageProvider();
    if (provider !== 'r2') {
        throw new Error('Set FILE_STORAGE_PROVIDER=r2 and configure R2 credentials before migration.');
    }
    r2Storage.getR2Config();

    const referencesByUrl = await discoverReferences();
    const candidates = [...referencesByUrl.entries()].filter(([url]) => url.includes('res.cloudinary.com'));
    console.log(`${execute ? 'Migrating' : 'Dry run'} ${candidates.length} referenced Cloudinary files. Cloudinary originals will not be deleted.`);
    let completed = 0;
    for (const [fileUrl, references] of candidates) {
        await migrateOneFile(fileUrl, references, execute);
        completed += 1;
        console.log(`${completed}/${candidates.length} references ${execute ? 'copied and verified' : 'validated'}.`);
    }
    console.log(execute
        ? `Migration complete. ${completed} files copied and verified; Cloudinary originals remain untouched.`
        : 'Dry run complete. No database or object storage files were changed. Re-run with --execute to migrate.');
};

run().catch((error) => {
    console.error('Cloudinary-to-R2 migration failed:', error.message);
    process.exitCode = 1;
}).finally(async () => {
    await db.end();
});