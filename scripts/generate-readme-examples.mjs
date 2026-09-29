import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outputDirectory = path.resolve("docs/images");
await mkdir(outputDirectory, { recursive: true });

/** Creates a synthetic room illustration, optionally including a person. */
function roomScene(includePerson) {
  const person = includePerson
    ? `<ellipse cx="606" cy="601" rx="94" ry="18" fill="#51453d" opacity="0.2"/>
       <circle cx="605" cy="309" r="42" fill="#bf7654"/>
       <path d="M568 357 Q605 337 642 357 L674 511 Q643 536 606 519 Q570 537 536 511 Z" fill="#315d63"/>
       <path d="M565 375 L503 463 L523 478 L584 425 M641 375 L702 458 L685 475 L626 426" fill="none" stroke="#bf7654" stroke-width="24" stroke-linecap="round"/>
       <path d="M565 511 L548 595 M647 511 L665 595" fill="none" stroke="#3e4146" stroke-width="27" stroke-linecap="round"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
    <defs>
      <linearGradient id="wall" x2="0" y2="1"><stop stop-color="#e9d9c6"/><stop offset="1" stop-color="#d8c0a7"/></linearGradient>
      <linearGradient id="floor" x2="0" y2="1"><stop stop-color="#b9825d"/><stop offset="1" stop-color="#986947"/></linearGradient>
    </defs>
    <rect width="1200" height="540" fill="url(#wall)"/>
    <rect y="540" width="1200" height="180" fill="url(#floor)"/>
    <path d="M0 540 H1200" stroke="#f5e9d9" stroke-width="13"/>
    <rect x="80" y="86" width="335" height="305" rx="5" fill="#f4eadb"/>
    <rect x="98" y="104" width="299" height="269" fill="#a9c6c7"/>
    <path d="M248 104 V373 M98 238 H397" stroke="#f4eadb" stroke-width="13"/>
    <path d="M98 104 L397 373 M397 104 L98 373" stroke="#e7ded0" stroke-width="3" opacity="0.55"/>
    <rect x="859" y="95" width="242" height="332" rx="4" fill="#bd7656"/>
    <rect x="882" y="119" width="196" height="284" fill="#d99a71"/>
    <path d="M980 119 V403" stroke="#bd7656" stroke-width="8"/>
    <circle cx="1060" cy="267" r="8" fill="#f4dfba"/>
    <path d="M115 611 Q165 550 215 611 Z" fill="#3e6860"/>
    <path d="M164 612 V519 M163 558 Q122 547 119 514 M165 570 Q205 553 208 521" fill="none" stroke="#577d68" stroke-width="13" stroke-linecap="round"/>
    <path d="M105 612 H225 L210 669 H120 Z" fill="#c77855"/>
    <rect x="390" y="511" width="415" height="20" rx="10" fill="#f2e4d1" opacity="0.6"/>
    ${person}
  </svg>`;
}

const beforePath = path.join(outputDirectory, "synthetic-before.png");
const afterPath = path.join(outputDirectory, "synthetic-after.png");
const previewPath = path.join(outputDirectory, "comparison-preview.png");
const beforeBuffer = await sharp(Buffer.from(roomScene(true))).png().toBuffer();
const afterBuffer = await sharp(Buffer.from(roomScene(false))).png().toBuffer();

await Promise.all([
  writeFile(beforePath, beforeBuffer),
  writeFile(afterPath, afterBuffer),
]);

const panelWidth = 680;
const panelHeight = 408;
const headerHeight = 64;
const padding = 28;
const gap = 28;
const resizedBefore = await sharp(beforeBuffer)
  .resize(panelWidth, panelHeight, { fit: "contain", background: "#ffffff" })
  .png()
  .toBuffer();
const resizedAfter = await sharp(afterBuffer)
  .resize(panelWidth, panelHeight, { fit: "contain", background: "#ffffff" })
  .png()
  .toBuffer();
/** Creates an SVG title strip for a comparison panel. */
const label = (text, color, width) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${headerHeight}"><text x="0" y="31" fill="${color}" font-family="Segoe UI, sans-serif" font-size="23" font-weight="700">${text}</text></svg>`,
);
const previewWidth = padding * 2 + panelWidth * 2 + gap;
const previewHeight = padding * 2 + headerHeight + panelHeight + 44;
const note = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${previewWidth}" height="34"><text x="0" y="22" fill="#6f7771" font-family="Segoe UI, sans-serif" font-size="14">SYNTHETIC EXAMPLE · NOT MODEL OUTPUT</text></svg>`,
);

await sharp({
  create: {
    width: previewWidth,
    height: previewHeight,
    channels: 3,
    background: "#eceeea",
  },
})
  .composite([
    { input: label("Before", "#252a27", panelWidth), left: padding, top: padding },
    { input: label("After", "#252a27", panelWidth), left: padding + panelWidth + gap, top: padding },
    { input: resizedBefore, left: padding, top: padding + headerHeight },
    { input: resizedAfter, left: padding + panelWidth + gap, top: padding + headerHeight },
    { input: note, left: padding, top: padding + headerHeight + panelHeight + 7 },
  ])
  .png()
  .toFile(previewPath);

console.log(`Generated synthetic README examples in ${outputDirectory}`);