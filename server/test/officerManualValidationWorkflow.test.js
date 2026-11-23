const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { test } = require('node:test');

const dbPath = require.resolve('../config/db');
const fakeDb = {
  query: null,
  promise: () => ({ query: async () => [[], []] }),
};
const fakeDbModule = new Module(dbPath, module);
fakeDbModule.filename = dbPath;
fakeDbModule.loaded = true;
fakeDbModule.exports = fakeDb;
require.cache[dbPath] = fakeDbModule;

const submissionController = require('../controllers/submissionController');
const cloudinary = require('../config/cloudinary');

delete require.cache[dbPath];

const invoke = (handler, request) => new Promise(resolve => {
  let statusCode = 200;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      resolve({ statusCode, body });
    },
  };
  const result = handler(request, res);
  if (result && typeof result.catch === 'function') {
    result.catch(error => resolve({ statusCode: 500, body: error }));
  }
});

test('Officer validation queue includes every submission type and grades in assigned year levels only', async () => {
  fakeDb.query = (sql, values, callback) => {
    if (typeof values === 'function') callback = values;
    if (sql.includes('FROM submissions s')) {
      callback(null, [
        { id: 1, scholar_id: 'S12', full_name: 'Grade 12 Scholar', year_level: 'Grade 12', submission_type: 'letter', status: 'pending' },
        { id: 2, scholar_id: 'S12', full_name: 'Grade 12 Scholar', year_level: 'Grade 12', submission_type: 'cor', status: 'pending' },
        { id: 3, scholar_id: 'S12', full_name: 'Grade 12 Scholar', year_level: 'Grade 12', submission_type: 'other', status: 'pending' },
        { id: 5, scholar_id: 'S12', full_name: 'Grade 12 Scholar', year_level: 'Grade 12', submission_type: 'report_card', status: 'pending' },
        { id: 6, scholar_id: 'S12', full_name: 'Grade 12 Scholar', year_level: 'Grade 12', submission_type: 'cor', status: 'approved', finalized_at: null },
        { id: 7, scholar_id: 'S12', full_name: 'Grade 12 Scholar', year_level: 'Grade 12', submission_type: 'other', status: 'approved', finalized_at: '2026-10-27 10:00:00' },
        { id: 4, scholar_id: 'S10', full_name: 'Grade 10 Scholar', year_level: 'Grade 10', submission_type: 'letter', status: 'pending' },
      ]);
      return;
    }
    if (sql.includes('FROM grades g')) {
      callback(null, [
        { scholar_id: 'S12', full_name: 'Grade 12 Scholar', year_level: 'Grade 12', semester: '1st', academic_year: '2025-2026', subject_name: 'Math', units: 3, grade: '2.0', status: 'pending' },
        { scholar_id: 'S10', full_name: 'Grade 10 Scholar', year_level: 'Grade 10', semester: '1st', academic_year: '2025-2026', subject_name: 'Math', units: 3, grade: '2.0', status: 'pending' },
      ]);
      return;
    }
    if (sql.includes('FROM officer_year_level_assignments')) {
      callback(null, [{ year_level: 'grade_12' }]);
      return;
    }
    if (sql.includes("role = 'scholar'")) {
      callback(null, [
        { scholar_id: 'S12', full_name: 'Grade 12 Scholar', year_level: 'Grade 12' },
        { scholar_id: 'S10', full_name: 'Grade 10 Scholar', year_level: 'Grade 10' },
      ]);
      return;
    }
    callback(new Error(`Unexpected query: ${sql}`));
  };

  const response = await invoke(submissionController.getScholarSubmissions, {
    user: { id: 8, role: 'officer' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.map(scholar => scholar.scholar_id), ['S12']);
  assert.equal(response.body[0].scholar_id, 'S12');
  assert.deepEqual(response.body[0].monthly_letters.map(item => item.id), [1]);
  assert.equal(response.body[0].report_cards.length, 1);
  assert.deepEqual(response.body[0].cors.map(item => item.id), [2, 6]);
  assert.equal(response.body[0].other_documents.length, 1);
  assert.equal(response.body[0].grades.length, 1);
});

test('Officer grade approval is limited to pending records and assigned year levels', async () => {
  let update;
  fakeDb.query = (sql, values, callback) => {
    if (sql.trimStart().startsWith('UPDATE grades')) update = { sql, values };
    callback(null, { affectedRows: 1 });
  };

  const response = await invoke(submissionController.reviewGrades, {
    user: { id: 8, role: 'officer' },
    body: {
      scholar_id: 'S12',
      semester: '1st',
      academic_year: '2025-2026',
      status: 'approved',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.match(update.sql, /verification_status = 'pending'/);
  assert.match(update.sql, /finalized_at = CASE WHEN \? = 'approved' THEN NOW\(\) ELSE NULL END/);
  assert.match(update.sql, /export_available_at = CASE WHEN \? = 'approved' THEN NOW\(\) ELSE NULL END/);
  assert.match(update.sql, /officer_year_level_assignments/);
  assert.equal(update.values[0], 'approved');
  assert.equal(update.values[7], 'S12');
  assert.equal(update.values[10], 8);
  assert.match(update.values[6], /^[0-9a-f-]{36}$/i);
});

test('Admin cannot make a compliance review decision', async () => {
  let queryCount = 0;
  fakeDb.query = () => { queryCount += 1; };

  const submissionResponse = await invoke(submissionController.reviewSubmission, {
    params: { id: '1' },
    user: { id: 2, role: 'admin' },
    body: { status: 'approved' },
  });
  const gradesResponse = await invoke(submissionController.reviewGrades, {
    user: { id: 2, role: 'admin' },
    body: {
      scholar_id: 'S12',
      semester: '1st',
      academic_year: '2025-2026',
      status: 'approved',
    },
  });

  assert.equal(submissionResponse.statusCode, 403);
  assert.equal(gradesResponse.statusCode, 403);
  assert.equal(queryCount, 0);
});

test('registered public Cloudinary PDFs preview when their cloud differs from current config', async () => {
  const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const originalPrivateDownloadUrl = cloudinary.utils.private_download_url;
  const originalFetch = global.fetch;
  const cloudinaryUrl = 'http://res.cloudinary.com/test-cloud/image/upload/v1795413287/apple-scholar/generated-letters/submission-11.pdf';
  let fetchedUrl = '';
  let privateDownloadCalled = false;
  const responseHeaders = {};

  process.env.CLOUDINARY_CLOUD_NAME = 'current-cloud';
  cloudinary.utils.private_download_url = () => {
    privateDownloadCalled = true;
    return 'https://res.cloudinary.com/test-cloud/image/authenticated/private_download/submission-11.pdf';
  };
  global.fetch = async url => {
    fetchedUrl = String(url);
    return {
      ok: true,
      headers: { get: name => name === 'content-type' ? 'application/pdf' : null },
      arrayBuffer: async () => Buffer.from('%PDF-1.4'),
    };
  };

  fakeDb.query = (sql, values, callback) => {
    if (sql.includes('FROM submissions')) {
      callback(null, [{ scholar_id: 'S12', resource_id: 11, resource_type: 'letter' }]);
    } else if (sql.includes('FROM privacy_settings')) {
      callback(null, [{ access_logging: false, privacy_monitoring: false }]);
    } else if (sql.includes('FROM file_assets')) {
      callback(null, [{
        public_id: 'apple-scholar/generated-letters/submission-11',
        resource_type: 'image',
        file_format: 'pdf',
        scholar_id: 'S12',
      }]);
    } else if (sql.includes('FROM admin_preferences')) {
      callback(null, []);
    } else if (sql.includes('INSERT INTO audit_logs')) {
      callback(null, { affectedRows: 1 });
    } else {
      callback(new Error(`Unexpected query: ${sql}`));
    }
  };

  try {
    let statusCode = 200;
    let body;
    const response = await submissionController.previewCloudinaryFile({
      query: { url: cloudinaryUrl },
      user: { id: 8, role: 'admin' },
    }, {
      status(code) {
        statusCode = code;
        return this;
      },
      json(value) {
        body = value;
      },
      setHeader(name, value) {
        responseHeaders[name.toLowerCase()] = value;
      },
      send(value) {
        body = value;
      },
    });

    assert.equal(response, undefined);
    assert.equal(statusCode, 200);
    assert.ok(Buffer.isBuffer(body));
    assert.equal(responseHeaders['content-type'], 'application/pdf');
    assert.equal(fetchedUrl, cloudinaryUrl.replace(/^http:/, 'https:'));
    assert.equal(privateDownloadCalled, false);
  } finally {
    if (originalCloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
    cloudinary.utils.private_download_url = originalPrivateDownloadUrl;
    global.fetch = originalFetch;
  }
});

test('authenticated Cloudinary uploads with stored http URLs preview securely over https', async () => {
  const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const originalPrivateDownloadUrl = cloudinary.utils.private_download_url;
  const originalFetch = global.fetch;
  const cloudinaryUrl = 'http://res.cloudinary.com/test-cloud/image/authenticated/s--signed--/v1/apple-scholar/submissions/other-documents/photo.jpg';
  let fetchedUrl = '';
  let privateDownloadOptions;
  const responseHeaders = {};

  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  cloudinary.utils.private_download_url = (publicId, extension, options) => {
    privateDownloadOptions = { publicId, extension, options };
    return 'https://res.cloudinary.com/test-cloud/image/authenticated/private_download/photo.jpg';
  };
  global.fetch = async (url) => {
    fetchedUrl = String(url);
    return {
      ok: true,
      headers: { get: name => name === 'content-type' ? 'image/jpeg' : null },
      arrayBuffer: async () => Buffer.from([1, 2, 3]),
    };
  };

  fakeDb.query = (sql, values, callback) => {
    if (sql.includes('FROM submissions')) {
      callback(null, [{ scholar_id: 'S12', resource_id: 21, resource_type: 'other' }]);
    } else if (sql.includes('FROM privacy_settings')) {
      callback(null, [{ access_logging: false, privacy_monitoring: false }]);
    } else if (sql.includes('FROM file_assets')) {
      callback(null, [{
        public_id: 'apple-scholar/submissions/other-documents/photo',
        resource_type: 'image',
        file_format: 'jpg',
        scholar_id: 'S12',
      }]);
    } else if (sql.includes('FROM admin_preferences')) {
      callback(null, []);
    } else if (sql.includes('INSERT INTO audit_logs')) {
      callback(null, { affectedRows: 1 });
    } else {
      callback(new Error(`Unexpected query: ${sql}`));
    }
  };

  try {
    let statusCode = 200;
    let body;
    const response = await submissionController.previewCloudinaryFile({
      query: { url: cloudinaryUrl },
      user: { id: 8, role: 'admin' },
    }, {
      status(code) {
        statusCode = code;
        return this;
      },
      json(value) {
        body = value;
      },
      setHeader(name, value) {
        responseHeaders[name.toLowerCase()] = value;
      },
      send(value) {
        body = value;
      },
    });

    assert.equal(response, undefined);
    assert.equal(statusCode, 200);
    assert.ok(Buffer.isBuffer(body));
    assert.equal(responseHeaders['content-type'], 'image/jpeg');
    assert.equal(privateDownloadOptions.publicId, 'apple-scholar/submissions/other-documents/photo');
    assert.equal(privateDownloadOptions.options.type, 'authenticated');
    assert.ok(fetchedUrl.startsWith('https://'));
  } finally {
    if (originalCloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
    cloudinary.utils.private_download_url = originalPrivateDownloadUrl;
    global.fetch = originalFetch;
  }
});
