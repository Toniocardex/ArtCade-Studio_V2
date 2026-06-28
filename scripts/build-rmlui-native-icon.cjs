const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const repoRoot = path.resolve(__dirname, "..");
const sourceSvg = path.join(repoRoot, "ArtCade_logo_noName.svg");
const outputDir = path.join(repoRoot, "runtime-cpp", "src", "editor-native", "resources");
const outputPng = path.join(outputDir, "app-icon.png");
const outputIco = path.join(outputDir, "app-icon.ico");
const sizes = [256, 128, 64, 48, 32, 16];

function writeUInt16LE(buffer, value, offset) {
  buffer.writeUInt16LE(value, offset);
}

function writeUInt32LE(buffer, value, offset) {
  buffer.writeUInt32LE(value, offset);
}

async function renderPng(svg, size) {
  return sharp(svg).resize(size, size, { fit: "contain" }).png().toBuffer();
}

function makeIco(images) {
  const headerSize = 6;
  const entrySize = 16;
  const directorySize = headerSize + images.length * entrySize;
  const totalSize = directorySize + images.reduce((sum, image) => sum + image.data.length, 0);
  const buffer = Buffer.alloc(totalSize);

  writeUInt16LE(buffer, 0, 0);
  writeUInt16LE(buffer, 1, 2);
  writeUInt16LE(buffer, images.length, 4);

  let imageOffset = directorySize;
  images.forEach((image, index) => {
    const entryOffset = headerSize + index * entrySize;
    buffer[entryOffset] = image.size === 256 ? 0 : image.size;
    buffer[entryOffset + 1] = image.size === 256 ? 0 : image.size;
    buffer[entryOffset + 2] = 0;
    buffer[entryOffset + 3] = 0;
    writeUInt16LE(buffer, 1, entryOffset + 4);
    writeUInt16LE(buffer, 32, entryOffset + 6);
    writeUInt32LE(buffer, image.data.length, entryOffset + 8);
    writeUInt32LE(buffer, imageOffset, entryOffset + 12);
    image.data.copy(buffer, imageOffset);
    imageOffset += image.data.length;
  });

  return buffer;
}

(async () => {
  const svg = fs.readFileSync(sourceSvg);
  const images = [];
  for (const size of sizes) {
    images.push({ size, data: await renderPng(svg, size) });
  }

  fs.writeFileSync(outputPng, images[0].data);
  fs.writeFileSync(outputIco, makeIco(images));
  console.log(`Wrote ${outputPng}`);
  console.log(`Wrote ${outputIco}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
