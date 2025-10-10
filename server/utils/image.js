const sharp = require('sharp');
const fs = require('fs');

/**
 * Generates an SVG containing text information.
 *
 * Changes:
 * - Text is now left-aligned ('text-anchor: start').
 * - Text remains vertically centered within the footer area.
 * - Adjusted vertical spacing for the text block to have equal space above and below.
 */
function generateFooterSVG(name, designation, phone, textWidth, footerHeight, fontSize, isTeamName = false) {
  // Add more vertical space between lines for clarity
  const totalLines = 4;
  const lineHeight = Math.round(fontSize * 1.5); // Increased line height for more space
  const totalHeight = lineHeight * totalLines;
  const verticalPadding = (footerHeight - totalHeight) / 2;
  const startY = verticalPadding + lineHeight * 0.6; // First baseline
  const textPadding = 2; // Consistent left padding
  // Minimum font size allowed; lower value to avoid forced overflow
  const MIN_FONT_SIZE = 12;
  const allFontSizeInitial = Math.max(fontSize, 18);
  let allFontSize = allFontSizeInitial;

  // Helper: normalize casing and format designation
  const normalizeDesignation = (d) => {
    if (!d) return 'N/A | WealthPlus';
    const dl = d.toLowerCase();
    if (dl.includes('wealth')) return 'Wealth Manager | WealthPlus';
    if (dl.includes('health')) return 'Health Insurance Advisor | WealthPlus';
    return `${d.replace(/\s+/g, ' ').trim()} | WealthPlus`;
  };

  // If this is a team name, show it exactly as entered by the user without appending '| WealthPlus'
  const formattedDesignation = isTeamName
    ? (String(designation || '').trim())
    : normalizeDesignation(designation || '');

  // Escape XML special chars for SVG
  const escapeXml = (unsafe) => String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  // Prepare lines and dynamically adjust font size to fit within textWidth
  const lines = [
    String(name || ''),
    formattedDesignation,
    `✔️ Investments ✔️ Insurance ✔️ Properties`,
    `Phone: ${String(phone || '')}`,

  ].map(l => escapeXml(l));

  // Estimate character width (~0.55 * fontSize) and reduce font size until fits
  const maxTextWidth = Math.max(10, textWidth - textPadding * 2);
  const approxCharWidth = (fs && fs.existsSync) ? 0.55 : 0.55; // kept for clarity
  const fitsAtSize = (size) => {
    const charWidth = size * approxCharWidth;
    return lines.every(line => (line.length * charWidth) <= maxTextWidth);
  };

  // Reduce font size until all lines fit or until MIN_FONT_SIZE
  while (allFontSize > MIN_FONT_SIZE && !fitsAtSize(allFontSize)) {
    allFontSize = Math.max(MIN_FONT_SIZE, Math.floor(allFontSize * 0.92));
    // safety break
    if (allFontSize <= MIN_FONT_SIZE) break;
  }

  let svgLines = [];
  let y = startY;
  for (const l of lines) {
    svgLines.push(`<text x="${textPadding}" y="${y}" class="footertext">${l}</text>`);
    y += lineHeight;
  }

  return `
    <svg width="${textWidth}" height="${footerHeight}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .footertext {
          font-family: Arial, sans-serif;
          fill: #292d6c;
          font-weight: bold;
          font-size: ${allFontSize}px;
          text-anchor: start;
          dominant-baseline: middle;
        }
      </style>
      ${svgLines.join('\n')}
    </svg>
  `;
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
    // Debug: dump incoming person and paths to investigate missing-field errors
    try {
      console.log('DEBUG createFinalPoster input -> templatePath:', templatePath);
      console.log('DEBUG createFinalPoster input -> logoPath:', logoPath);
      console.log('DEBUG createFinalPoster input -> outputPath:', outputPath);
      console.log('DEBUG createFinalPoster input -> person (raw):', person);
      if (person) {
        console.log('DEBUG person fields -> name:', person.name, 'type:', typeof person.name);
        console.log('DEBUG person fields -> photo:', person.photo, 'type:', typeof person.photo);
        console.log('DEBUG person fields -> designation:', person.designation, 'type:', typeof person.designation);
        console.log('DEBUG person fields -> phone:', person.phone, 'type:', typeof person.phone);
      }
    } catch (dE) {
      console.warn('DEBUG logging failed inside createFinalPoster:', dE && dE.message ? dE.message : dE);
    }
    // Validate inputs
    if (!templatePath || !person || !logoPath || !outputPath) {
      throw new Error('Missing required parameters');
    }

    // Validate person object
    if (!person.name || !person.photo || !person.designation) {
      throw new Error('Missing required person information');
    }

    // Ensure template exists and is readable
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    // Create a temporary copy of the template to avoid file locking issues
    const tempTemplatePath = `${templatePath}_temp`;
    await fs.promises.copyFile(templatePath, tempTemplatePath);

    const templateResized = await sharp(tempTemplatePath)
      .resize({ width: 800 })
      .toBuffer();
    
    // Clean up temp file
    try {
      fs.unlinkSync(tempTemplatePath);
    } catch (err) {
      console.warn('Template cleanup failed (ignored):', err.message);
    }

    const templateMetadata = await sharp(templateResized).metadata();
    const width = templateMetadata.width;

  const photoSize = Math.floor(width * 0.18);
  const fontSize = Math.round(width * 0.022); // ~18px for 800px width
  const logoSize = Math.floor(width * 0.15);

  // Reserve layout positions so logo/line don't overlap text.
  const photoLeft = 40;
  const textLeft = photoLeft + photoSize + 20;
  const lineWidth = 4;
  const lineGap = 20; // gap between text and vertical line
  const rightMargin = 24; // margin between logo and right edge
  // available space for text before the vertical line and logo
  const reservedRight = lineGap + lineWidth + logoSize + rightMargin;
  let textWidth = Math.max(Math.floor(width * 0.38), width - textLeft - reservedRight);
  if (textWidth < 120) textWidth = Math.max(120, Math.floor(width * 0.35));

  // Footer height: 4 lines, minimal vertical space, plus padding
  const lineHeight = Math.round(fontSize * 1.18);
  const requiredTextHeight = lineHeight * 4;
  const footerHeight = Math.max(photoSize, requiredTextHeight, logoSize) + 18;

  // Always use the exact designation from person.designation (as filtered by send-posters)
  // If person has a teamName, treat the designation as a team name and display only that
  const isTeamName = Boolean(person.teamName && String(person.teamName).trim());
  const footerSVG = generateFooterSVG(
    person.name,
    isTeamName ? person.teamName : person.designation,
    person.phone,
    textWidth,
    footerHeight,
    fontSize,
    isTeamName
  );

  const textBuffer = await sharp(Buffer.from(footerSVG)).png().toBuffer();
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

  // Move vertical line and logo relative to measured text width
  const rightSectionStart = textLeft + textMetadata.width + 10;
  const lineX = Math.min(textLeft + textWidth + 8, rightSectionStart + 8);
  let logoXCentered = lineX + lineWidth + 16;
  // ensure logo doesn't overflow the template width
  const maxLogoLeft = width - logoSize - rightMargin;
  if (logoXCentered > maxLogoLeft) {
    logoXCentered = maxLogoLeft;
  }

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
  generateFooterSVG,
  processCircularImage,
  createFinalPoster,
};