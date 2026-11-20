const sharp = require('sharp');

const normalizeToPng = async (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Image buffer is empty or invalid.');
  }

  return sharp(buffer).rotate().png().toBuffer();
};

module.exports = { normalizeToPng };
