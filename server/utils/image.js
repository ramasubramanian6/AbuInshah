const sharp = require('sharp');
const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

/* -------------------------------
    ✅ FIXED: SAFE FONT LOADING
  -------------------------------- */
const fontPath = path.join(__dirname, '../assets/fonts/NotoSans-Regular.ttf');
const italicFontPath = path.join(__dirname, '../Noto_Sans/static/NotoSans-Italic.ttf');
const emojiFontPath = path.join(__dirname, '../Noto_Sans/NotoColorEmoji.ttf');

// Warn clearly if fonts are missing (production issue)
if (!fs.existsSync(fontPath)) {
   console.error('❌ FONT FILE NOT FOUND:', fontPath);
   console.error('➡️ Make sure assets/fonts/NotoSans-Regular.ttf exists in backend.');
 }
if (!fs.existsSync(italicFontPath)) {
   console.error('❌ ITALIC FONT FILE NOT FOUND:', italicFontPath);
   console.error('➡️ Make sure Noto_Sans/static/NotoSans-Italic.ttf exists in backend.');
 }
if (!fs.existsSync(emojiFontPath)) {
   console.error('❌ EMOJI FONT FILE NOT FOUND:', emojiFontPath);
   console.error('➡️ Make sure Noto_Sans/NotoColorEmoji.ttf exists in backend.');
 }

let fontBase64 = '';
let italicFontBase64 = '';
let emojiFontBase64 = '';
try {
   fontBase64 = fs.readFileSync(fontPath).toString('base64');
   console.log('✅ Regular font loaded successfully.');
} catch (e) {
   console.error('❌ ERROR reading regular font file:', e.message);
}
try {
   italicFontBase64 = fs.readFileSync(italicFontPath).toString('base64');
   console.log('✅ Italic font loaded successfully.');
} catch (e) {
   console.error('❌ ERROR reading italic font file:', e.message);
}
try {
   emojiFontBase64 = fs.readFileSync(emojiFontPath).toString('base64');
   console.log('✅ Emoji font loaded successfully.');
} catch (e) {
   console.error('❌ ERROR reading emoji font file:', e.message);
}

try {
   registerFont(fontPath, { family: 'Noto Sans', weight: 'normal', style: 'normal' });
   console.log('✅ Regular font registered.');
} catch (e) {
   console.error('❌ ERROR registering regular font:', e.message);
}
try {
   registerFont(italicFontPath, { family: 'Noto Sans', weight: 'normal', style: 'italic' });
   console.log('✅ Italic font registered.');
} catch (e) {
   console.error('❌ ERROR registering italic font:', e.message);
}
try {
   registerFont(emojiFontPath, { family: 'Noto Color Emoji' });
   console.log('✅ Emoji font registered.');
} catch (e) {
   console.error('❌ ERROR registering emoji font:', e.message);
}



/**
 * Crops an image into a circle.
 */
async function processCircularImage(inputPath, outputPath, size) {
  const circleMask = Buffer.from(
    `<svg width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
    </svg>`
  );

  const buffer = await sharp(inputPath)
    .resize(size, size)
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .jpeg()
    .toBuffer();

  fs.writeFileSync(outputPath, buffer);
}



/**
 * Creates the final composite poster.
 */
async function createFinalPoster({ templatePath, person, logoPath, outputPath }) {
  try {
    console.log('DEBUG createFinalPoster input:', { templatePath, logoPath, outputPath, person });

    if (!templatePath || !person || !logoPath || !outputPath) {
      throw new Error('Missing required parameters');
    }

    if (!person.name || !person.photo || !person.designation) {
      throw new Error('Missing required person information');
    }

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    const tempTemplatePath = `${templatePath}_temp`;
    await fs.promises.copyFile(templatePath, tempTemplatePath);

    const templateResized = await sharp(tempTemplatePath)
      .resize({ width: 800 })
      .toBuffer();

    fs.unlinkSync(tempTemplatePath);

    const templateMetadata = await sharp(templateResized).metadata();
    const width = templateMetadata.width;

    const photoSize = Math.floor(width * 0.18);
    const fontSize = Math.round(width * 0.022);
    const logoSize = Math.floor(width * 0.15);

    const photoLeft = 40;
    const textLeft = photoLeft + photoSize + 20;

    const lineWidth = 4;
    const lineGap = 20;
    const rightMargin = 24;
    const reservedRight = lineGap + lineWidth + logoSize + rightMargin;

    let textWidth = Math.max(Math.floor(width * 0.38), width - textLeft - reservedRight);
    if (textWidth < 120) textWidth = Math.max(120, Math.floor(width * 0.35));

    const lineHeight = Math.round(fontSize * 1.18);
    const requiredTextHeight = lineHeight * 4;
    const footerHeight = Math.max(photoSize, requiredTextHeight, logoSize) + 24;

    const isTeamName = Boolean(person.teamName && String(person.teamName).trim());
    const normalizeDesignation = (d) => {
      if (!d) return 'N/A | WealthPlus';
      const dl = d.toLowerCase();
      if (dl.includes('wealth')) return 'Wealth Manager | WealthPlus';
      if (dl.includes('health')) return 'Health Insurance Advisor | WealthPlus';
      return `${d.replace(/\s+/g, ' ').trim()} | WealthPlus`;
    };

    const formattedDesignation = isTeamName
      ? (String(person.teamName || '').trim())
      : normalizeDesignation(person.designation || '');

    const lines = [
      String(person.name || ''),
      formattedDesignation,
      `✔️ Investments ✔️ Insurance ✔️ Properties`,
      `Phone: ${String(person.phone || '')}`,
    ];

    const maxTextWidth = Math.max(10, textWidth - 2 * 2);
    const approxCharWidth = 0.55;

    const fitsAtSize = (size) => {
      const charWidth = size * approxCharWidth;
      return lines.every(line => (line.length * charWidth) <= maxTextWidth);
    };

    let allFontSize = Math.max(fontSize, 24);
    const MIN_FONT_SIZE = 12;
    while (allFontSize > MIN_FONT_SIZE && !fitsAtSize(allFontSize)) {
      allFontSize = Math.max(MIN_FONT_SIZE, Math.floor(allFontSize * 0.92));
      if (allFontSize <= MIN_FONT_SIZE) break;
    }

    const totalLines = 4;
    const textLineHeight = Math.round(allFontSize * 1.5);
    const totalHeight = textLineHeight * totalLines;
    const verticalPadding = (footerHeight - totalHeight) / 2;
    const startY = verticalPadding + textLineHeight * 0.6;
    const textPadding = 2;

    const canvas = createCanvas(textWidth, footerHeight);
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#292d6c';
    let y = startY;
    for (let i = 0; i < lines.length; i++) {
      if (i === 1) {
        ctx.font = `bold italic ${allFontSize}px "Noto Sans", "Noto Color Emoji"`;
      } else {
        ctx.font = `bold ${allFontSize}px "Noto Sans", "Noto Color Emoji"`;
      }
      ctx.fillText(lines[i], textPadding, y);
      y += textLineHeight;
    }

    const textBuffer = canvas.toBuffer('image/png');
    const textMetadata = await sharp(textBuffer).metadata();

    const circularPhoto = await sharp(person.photo)
      .resize(photoSize, photoSize)
      .composite([{
        input: Buffer.from(
          `<svg><circle cx="${photoSize / 2}" cy="${photoSize / 2}" r="${photoSize / 2}" fill="white"/></svg>`
        ),
        blend: 'dest-in'
      }])
      .png()
      .toBuffer();

    const resizedLogo = await sharp(logoPath)
      .resize({
        width: logoSize,
        height: logoSize,
        fit: 'contain',
        background: { r: 240, g: 247, b: 255 }
      })
      .flatten({ background: { r: 240, g: 247, b: 255 } })
      .jpeg()
      .toBuffer();

    const rightSectionStart = textLeft + textMetadata.width + 10;
    const lineX = Math.min(textLeft + textWidth + 8, rightSectionStart + 8);

    let logoXCentered = lineX + lineWidth + 16;
    const maxLogoLeft = width - logoSize - rightMargin;
    if (logoXCentered > maxLogoLeft) logoXCentered = maxLogoLeft;

    const lineY = Math.floor((footerHeight - logoSize) / 2);
    const lineHeightSVG = logoSize;

    const lineSVG = `<svg width="${lineWidth}" height="${lineHeightSVG}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${lineWidth}" height="${lineHeightSVG}" fill="#1B75BB"/></svg>`;
    const lineBuffer = await sharp(Buffer.from(lineSVG)).png().toBuffer();

    const gradientFooterBuffer = await sharp({
      create: {
        width,
        height: footerHeight,
        channels: 3,
        background: { r: 240, g: 247, b: 255 },
      }
    })
      .composite([
        { input: circularPhoto, top: Math.floor((footerHeight - photoSize) / 2), left: photoLeft },
        { input: textBuffer, top: Math.floor((footerHeight - textMetadata.height) / 2), left: textLeft },
        { input: lineBuffer, top: lineY, left: lineX },
        { input: resizedLogo, top: Math.floor((footerHeight - logoSize) / 2), left: logoXCentered },
      ])
      .jpeg()
      .toBuffer();

    const finalImageBuffer = await sharp({
      create: {
        width,
        height: templateMetadata.height + footerHeight,
        channels: 3,
        background: '#ffffff'
      }
    })
      .composite([
        { input: templateResized, top: 0, left: 0 },
        { input: gradientFooterBuffer, top: templateMetadata.height, left: 0 }
      ])
      .jpeg()
      .toBuffer();

    fs.writeFileSync(outputPath, finalImageBuffer);

  } catch (error) {
    console.error('Error in createFinalPoster:', error);
    throw error;
  }
}

module.exports = {
  processCircularImage,
  createFinalPoster,
};
