const test = require('node:test');
const assert = require('node:assert/strict');
const { rateLimit } = require('../middleware/rateLimit');

const request = () => ({
    ip: '192.0.2.10',
    headers: {},
    originalUrl: '/api/test',
});

const invoke = middleware => {
    const result = { next: false, headers: {}, statusCode: 200, body: null };
    const response = {
        setHeader: (name, value) => { result.headers[name] = value; },
        status: code => {
            result.statusCode = code;
            return response;
        },
        json: body => {
            result.body = body;
            return response;
        },
    };
    middleware(request(), response, () => { result.next = true; });
    return result;
};

test('rate-limit policies keep separate buckets for the same client IP', () => {
    const apiLimit = rateLimit({ windowMs: 60_000, max: 2 });
    const uploadLimit = rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 1,
        message: 'Upload limit reached. Please try again later.',
    });

    assert.equal(invoke(apiLimit).next, true);
    assert.equal(invoke(apiLimit).next, true);

    const firstUpload = invoke(uploadLimit);
    assert.equal(firstUpload.next, true);
    assert.equal(firstUpload.statusCode, 200);

    const secondUpload = invoke(uploadLimit);
    assert.equal(secondUpload.next, false);
    assert.equal(secondUpload.statusCode, 429);
    assert.equal(secondUpload.body.error, 'Upload limit reached. Please try again later.');
});
