/**
 * PWA Icon Generator
 * Generates all required PNG icons from SVG sources
 *
 * Usage:
 *   npm install sharp --save-dev (if not already installed)
 *   node scripts/generate-icons.js
 */

import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');
const screenshotsDir = join(publicDir, 'screenshots');

// Icon sizes to generate
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
const maskableSizes = [192, 512];

// Create directories if they don't exist
if (!existsSync(screenshotsDir)) {
  mkdirSync(screenshotsDir, { recursive: true });
}

// Generate regular icons from SVG
async function generateIcons() {
  console.log('Generating PWA icons...\n');

  const svgPath = join(publicDir, 'icon-512.svg');
  const maskableSvgPath = join(publicDir, 'icon-maskable.svg');

  try {
    const svgBuffer = readFileSync(svgPath);
    const maskableSvgBuffer = readFileSync(maskableSvgPath);

    // Generate regular icons
    for (const size of iconSizes) {
      const outputPath = join(publicDir, `icon-${size}.png`);
      await sharp(svgBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({ quality: 100 })
        .toFile(outputPath);
      console.log(`  Created: icon-${size}.png`);
    }

    // Generate maskable icons
    for (const size of maskableSizes) {
      const outputPath = join(publicDir, `icon-maskable-${size}.png`);
      await sharp(maskableSvgBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({ quality: 100 })
        .toFile(outputPath);
      console.log(`  Created: icon-maskable-${size}.png`);
    }

    console.log('\nAll icons generated successfully!');

  } catch (error) {
    console.error('Error generating icons:', error.message);
    console.log('\nMake sure sharp is installed: npm install sharp --save-dev');
    process.exit(1);
  }
}

// Generate placeholder screenshots
async function generatePlaceholderScreenshots() {
  console.log('\nGenerating placeholder screenshots...\n');

  const screenshots = [
    { name: 'dashboard-mobile.png', width: 1080, height: 1920 },
    { name: 'capture-mobile.png', width: 1080, height: 1920 },
    { name: 'dashboard-desktop.png', width: 1920, height: 1080 }
  ];

  for (const screenshot of screenshots) {
    const outputPath = join(screenshotsDir, screenshot.name);

    // Create a gradient placeholder with text
    const svg = `
      <svg width="${screenshot.width}" height="${screenshot.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#8B5CF6;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <text x="50%" y="50%" text-anchor="middle" fill="white" font-size="${Math.min(screenshot.width, screenshot.height) / 10}" font-family="system-ui, sans-serif" font-weight="bold">
          WealthPulse
        </text>
        <text x="50%" y="58%" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="${Math.min(screenshot.width, screenshot.height) / 20}" font-family="system-ui, sans-serif">
          ${screenshot.name.replace('.png', '').replace(/-/g, ' ')}
        </text>
      </svg>
    `;

    await sharp(Buffer.from(svg))
      .png({ quality: 90 })
      .toFile(outputPath);
    console.log(`  Created: screenshots/${screenshot.name}`);
  }

  console.log('\nPlaceholder screenshots generated!');
  console.log('Note: Replace these with actual app screenshots for best results.');
}

// Main execution
async function main() {
  console.log('=================================');
  console.log('  WealthPulse PWA Icon Generator');
  console.log('=================================\n');

  await generateIcons();
  await generatePlaceholderScreenshots();

  console.log('\n=================================');
  console.log('  Generation complete!');
  console.log('=================================');
}

main().catch(console.error);
