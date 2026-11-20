const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');
const db = require('../config/db');
const cloudinary = require('../config/cloudinary');
const r2Storage = require('./r2StorageService');
const { normalizeToPng } = require('./imageBufferService');

const promiseDb = db.promise();

const formatYearLevelLabel = (value) => {
  if (!value) return '';
  const normalized = String(value).trim().toLowerCase().replace(/_/g, ' ');
  const aliasMap = {
    'grade 7': 'Grade 7',
    'grade 8': 'Grade 8',
    'grade 9': 'Grade 9',
    'grade 10': 'Grade 10',
    'grade 11': 'Grade 11',
    'grade 12': 'Grade 12',
    'college 1': '1st Year College',
    'college 2': '2nd Year College',
    'college 3': '3rd Year College',
    'college 4': '4th Year College',
    'college 5': '5th Year College',
    '1st year college': '1st Year College',
    '2nd year college': '2nd Year College',
    '3rd year college': '3rd Year College',
    '4th year college': '4th Year College',
    '5th year college': '5th Year College',
  };

  return aliasMap[normalized] || value;
};

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'letter-template.docx');
const OUTPUT_DIR = path.join(__dirname, '..', 'uploads', 'generated-letters');
const SOFFICE_PATH = process.env.SOFFICE_PATH || (process.platform === 'win32'
  ? 'C:\\Program Files\\LibreOffice\\program\\soffice.exe'
  : 'soffice');

const ensureOutputDir = () => {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
};

const execAsync = (cmd) => new Promise((resolve, reject) => {
  exec(cmd, (err, stdout, stderr) => {
    if (err) return reject({ err, stdout, stderr });
    resolve({ stdout, stderr });
  });
});

const fetchImageBuffer = async (filePath) => {
  if (!filePath) return null;
  if (r2Storage.parseR2Uri(filePath)) {
    return r2Storage.readObjectBuffer(filePath);
  }

  if (/^https?:\/\//i.test(filePath)) {
    let downloadUrl = filePath;
    const parsedUrl = new URL(filePath);
    if (parsedUrl.hostname === 'res.cloudinary.com') {
      const [assetRows] = await promiseDb.query(
        'SELECT public_id, resource_type, file_format FROM file_assets WHERE file_url = ? LIMIT 1',
        [filePath]
      );
      if (assetRows.length > 0) {
        const asset = assetRows[0];
        downloadUrl = cloudinary.utils.private_download_url(
          asset.public_id,
          asset.file_format || 'bin',
          {
            resource_type: asset.resource_type || 'image',
            type: 'authenticated',
            expires_at: Math.floor(Date.now() / 1000) + 600,
            attachment: false,
          }
        );
      } else if (parsedUrl.protocol === 'http:') {
        parsedUrl.protocol = 'https:';
        downloadUrl = parsedUrl.toString();
      }
    }

    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`Remote image returned HTTP ${res.status}.`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) throw new Error('Remote image is empty.');
    return buffer;
  }

  const rel = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  const abs = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(abs)) throw new Error('Local image file was not found.');
  const buffer = fs.readFileSync(abs);
  if (buffer.length === 0) throw new Error('Local image file is empty.');
  return buffer;
};

async function generateLetterDocx(submissionId) {
  if (!submissionId) throw new Error('submissionId required');

  if (!Number.isInteger(Number(submissionId))) {
    throw new Error('Invalid submissionId');
  }

  const [rows] = await promiseDb.query(
    `SELECT s.id, s.letter_content, s.submitted_at, s.report_card_path, s.cor_path, s.generated_pdf_path, s.scholar_id
     FROM submissions s
     WHERE s.id = ? LIMIT 1`,
    [submissionId]
  );

  if (!rows || rows.length === 0) throw new Error('Submission not found');
  const sub = rows[0];

  let userProfile = { full_name: '', age: '', year_level: '', course: '', track_strand: '', school: '' };
  const [uRows] = await promiseDb.query('SELECT full_name, age, year_level, course, track_strand, school FROM users WHERE scholar_id = ? LIMIT 1', [sub.scholar_id]);
  if (uRows && uRows.length > 0) {
    userProfile = { ...userProfile, ...uRows[0] };
  }

  sub.full_name = userProfile.full_name || '';
  sub.age = userProfile.age ?? '';
  sub.year_level = formatYearLevelLabel(userProfile.year_level || '');
  const normalizedYearLevel = String(userProfile.year_level || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (/^grade_(11|12)$/.test(normalizedYearLevel)) {
    sub.course = userProfile.track_strand || '';
  } else if (/^grade_(7|8|9|10)$/.test(normalizedYearLevel)) {
    sub.course = '';
  } else {
    sub.course = userProfile.course || '';
  }
  sub.school = userProfile.school || '';

  const [mediaRows] = await promiseDb.query(
    `SELECT COALESCE(NULLIF(file_path, ''), NULLIF(photo_path, '')) AS file_path, description
     FROM submission_media WHERE submission_id = ? ORDER BY id ASC LIMIT 2`,
    [submissionId]
  );

  const data = {
    name: sub.full_name || '',
    age: sub.age ?? '',
    year_level: formatYearLevelLabel(sub.year_level || ''),
    course: sub.course || '',
    school: sub.school || '',
    date: sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '',
    letter_body: sub.letter_content || '',
    scholar_name: sub.full_name || '',
    documentation1_caption: mediaRows?.[0]?.description || '',
    documentation2_caption: mediaRows?.[1]?.description || '',
    additional_attachments_caption: (sub.report_card_path || sub.cor_path) ? 'Report Card/COR attached' : '',
  };

  const imageBuffers = {
    photo1: null,
    photo2: null,
  };
  for (let i = 0; i < Math.min(mediaRows.length, 2); i++) {
    const media = mediaRows[i];
    if (media && media.file_path) {
      const buffer = await fetchImageBuffer(media.file_path);
      imageBuffers[`photo${i + 1}`] = buffer ? await normalizeToPng(buffer) : null;
    }
  }

  if (!imageBuffers.photo1 && !imageBuffers.photo2) {
    console.warn(`No submission photos found for PDF generation (submission ${submissionId}).`);
  }

  data.photo1 = imageBuffers.photo1 ? 'photo1' : null;
  data.photo2 = imageBuffers.photo2 ? 'photo2' : null;

  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`Template not found at ${TEMPLATE_PATH}`);
  }

  const content = fs.readFileSync(TEMPLATE_PATH, 'binary');
  const zip = new PizZip(content);

  const imageModule = new ImageModule({
    getImage: (tagValue) => imageBuffers[tagValue],
    getSize: function(img, tagValue) {
      if (tagValue === 'photo2') return [200, 150];
      return [200, 150];
    }
  });

  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, modules: [imageModule] });

  try {
    doc.render(data);
  } catch (renderErr) {
    console.error('DOCX RENDER ERROR OBJECT:', renderErr);
    console.error('DOCX RENDER ERROR STACK:', renderErr.stack);
    if (renderErr.properties && renderErr.properties.errors) {
      console.error('DOCX RENDER ERROR DETAILS:', JSON.stringify(renderErr.properties.errors, null, 2));
    }
    throw renderErr;
  }

  return doc.getZip().generate({ type: 'nodebuffer' });
}

/**
 * Generate a PDF for a given submission ID by filling the docx template,
 * inserting up to two photos, converting to PDF via LibreOffice, and
 * saving the generated PDF under `server/uploads/generated-letters`.
 * Returns the public path (relative to `/uploads`) to the generated PDF.
 */
async function generateLetterPdf(submissionId) {
  const buf = await generateLetterDocx(submissionId);

  const [submissionRows] = await promiseDb.query(
    'SELECT scholar_id FROM submissions WHERE id = ? LIMIT 1',
    [submissionId]
  );
  if (!submissionRows || submissionRows.length === 0) {
    throw new Error('Submission not found');
  }
  const scholarId = submissionRows[0].scholar_id;

  ensureOutputDir();

  const timestamp = Date.now();
  const baseName = `submission-${submissionId}-${timestamp}`;
  const outDocx = path.join(OUTPUT_DIR, `${baseName}.docx`);
  const outPdf = path.join(OUTPUT_DIR, `${baseName}.pdf`);

  fs.writeFileSync(outDocx, buf);

  // Convert to PDF using LibreOffice headless
  const sofficeCommand = process.platform === 'win32' ? `"${SOFFICE_PATH}"` : SOFFICE_PATH;
  const cmd = `${sofficeCommand} --headless --convert-to pdf --outdir "${OUTPUT_DIR}" "${outDocx}"`;
  try {
    await execAsync(cmd);
  } catch (convErr) {
    // include stdout/stderr when available
    throw new Error('LibreOffice conversion failed: ' + JSON.stringify(convErr));
  }

  if (!fs.existsSync(outPdf)) {
    // LibreOffice sometimes names differently; try to guess fallback
    const altPdf = path.join(OUTPUT_DIR, `${baseName}.pdf`);
    if (!fs.existsSync(altPdf)) throw new Error('PDF not found after conversion');
  }

  let publicPath;
  let storageAsset = null;
  if (r2Storage.getStorageProvider() === 'r2') {
    const key = r2Storage.createObjectKey({
      folder: 'monthly-letters',
      scholarId,
      originalName: `${baseName}.pdf`,
    });
    storageAsset = await r2Storage.uploadFile({
      filePath: outPdf,
      key,
      contentType: 'application/pdf',
    });
    publicPath = storageAsset.url;
  } else {
    try {
      const uploadResult = await cloudinary.uploader.upload(outPdf, {
        resource_type: 'auto',
        folder: 'apple-scholar/generated-letters',
        public_id: baseName,
        overwrite: true,
      });

      publicPath = uploadResult.secure_url;
      storageAsset = uploadResult;
    } catch (cloudErr) {
      console.warn('Cloudinary upload failed, falling back to local static path:', cloudErr && cloudErr.message ? cloudErr.message : cloudErr);
      publicPath = path.posix.join('/uploads', 'generated-letters', `${baseName}.pdf`);
    }
  }

  await promiseDb.query('UPDATE submissions SET generated_pdf_path = ? WHERE id = ?', [publicPath, submissionId]);
  if (storageAsset) {
    await promiseDb.query(
      `INSERT INTO file_assets (scholar_id, file_url, public_id, resource_type, file_format)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE public_id = VALUES(public_id), resource_type = VALUES(resource_type), file_format = VALUES(file_format)`,
      [
        scholarId,
        publicPath,
        storageAsset.key || storageAsset.public_id,
        storageAsset.resourceType || storageAsset.resource_type || 'raw',
        storageAsset.format || 'pdf',
      ]
    );
  }

  return publicPath;
}

module.exports = {
  formatYearLevelLabel,
  generateLetterDocx,
  generateLetterPdf,
};
