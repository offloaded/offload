// Generate PWA icons as PNG files using SVG → sharp conversion
// Run: node scripts/generate-icons.js
// Requires: npm install sharp (dev dependency)

const fs = require("fs");
const path = require("path");

function generateSvg(size) {
  const fontSize = Math.round(size * 0.52);
  const yOffset = Math.round(size * 0.37);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.2)}" fill="#2C5FF6"/>
  <text x="50%" y="${50 + yOffset / size}%" dominant-baseline="central" text-anchor="middle"
    font-family="Plus Jakarta Sans, -apple-system, system-ui, sans-serif"
    font-weight="700" font-size="${fontSize}" fill="white">O</text>
</svg>`;
}

async function main() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    // Fallback: just write SVG files if sharp isn't available
    console.log("sharp not available, writing SVG fallback icons");
    const dir = path.join(__dirname, "..", "public", "icons");
    fs.mkdirSync(dir, { recursive: true });

    for (const size of [192, 512]) {
      const svg = generateSvg(size);
      fs.writeFileSync(path.join(dir, `icon-${size}.svg`), svg);
      console.log(`  wrote icon-${size}.svg`);
    }

    // Also write PNG-compatible SVGs with .png extension as a last resort
    // (won't actually be PNGs but browsers handle SVGs fine in most cases)
    return;
  }

  const dir = path.join(__dirname, "..", "public", "icons");
  fs.mkdirSync(dir, { recursive: true });

  for (const size of [192, 512]) {
    const svg = Buffer.from(generateSvg(size));
    await sharp(svg).resize(size, size).png().toFile(path.join(dir, `icon-${size}.png`));
    console.log(`  wrote icon-${size}.png (${size}x${size})`);
  }
}

main().catch(console.error);
