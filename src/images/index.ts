import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import open from "open";
import sharp from "sharp";

export { OutputDefinition } from "./output-definition";
export type { OutputDefinitionOptions } from "./output-definition";

export type ImageFormat = "jpg" | "png" | "webp";
type ImageMetadata = Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;

export class Image {
    /** Stores the source image data, metadata, and detected format. */
    constructor(
        readonly imagePath: string,
        readonly buffer: Buffer,
        readonly metadata: ImageMetadata,
        readonly format: ImageFormat,
    ) {}

    /** Returns the source image width in pixels when available. */
    get width(): number | undefined {
        return this.metadata.width;
    }

    /** Returns the source image height in pixels when available. */
    get height(): number | undefined {
        return this.metadata.height;
    }

    /** Returns width divided by height when both dimensions are valid. */
    get aspectRatio(): number | undefined {
        if (this.width === undefined || this.height === undefined || this.height === 0) {
            return undefined;
        }

        return this.width / this.height;
    }
}

/** Identifies a supported format from the image's binary signature. */
function detectImageFormat(image: Buffer): ImageFormat | undefined {
    if (image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff) {
        return "jpg";
    }

    if (image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return "png";
    }

    if (
        image.length >= 12 &&
        image.toString("ascii", 0, 4) === "RIFF" &&
        image.toString("ascii", 8, 12) === "WEBP"
    ) {
        return "webp";
    }

    return undefined;
}

/** Encodes the image buffer as a base64 string for API input. */
export function imageBufferToBase64(image: Image): string {
    return image.buffer.toString("base64");
}

/** Checks that the filename extension matches the image's detected format. */
export function checksAllowedImageFormats(imagePath: string, image: Buffer): ImageFormat {
    const extension = path.extname(imagePath).toLowerCase();
    const extensionFormats: Record<string, ImageFormat> = {
        ".jpg": "jpg",
        ".jpeg": "jpg",
        ".png": "png",
        ".webp": "webp",
    };
    const extensionFormat = extensionFormats[extension];
    const detectedFormat = detectImageFormat(image);

    if (!extensionFormat || detectedFormat !== extensionFormat) {
        throw new Error("Image must be a valid JPG, PNG, or WebP file with a matching filename extension.");
    }

    return detectedFormat;
}

/** Reads, validates, and extracts metadata from an image file. */
export async function readImage(filename: string): Promise<Image> {
    const imagePath = path.resolve(filename);
    let buffer: Buffer;
    try {
        buffer = await readFile(imagePath);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            throw new Error(`Image file does not exist: ${imagePath}`);
        }
        throw error;
    }

    const format = checksAllowedImageFormats(imagePath, buffer);
    const metadata = await sharp(buffer).metadata();
    if (metadata.width === undefined || metadata.height === undefined) {
        throw new Error(`Unable to read image dimensions: ${imagePath}`);
    }

    return new Image(imagePath, buffer, metadata, format);
}

/** Builds and opens a desktop comparison image with generated results tiled beside the source. */
export async function viewImageComparison(image: Image, generatedImages: Buffer[]): Promise<string> {
    const panelWidth = 900;
    const panelHeight = 700;
    const padding = 24;
    const gap = 24;
    const tileGap = 12;
    const headerHeight = 56;
    const imagePanel = await sharp(image.buffer)
        .rotate()
        .resize(panelWidth, panelHeight, { fit: "contain", background: "#ffffff", withoutEnlargement: true })
        .png()
        .toBuffer();
    const columns = Math.ceil(Math.sqrt(generatedImages.length));
    const rows = Math.ceil(generatedImages.length / columns);
    const tileWidth = Math.floor((panelWidth - tileGap * (columns - 1)) / columns);
    const tileHeight = Math.floor((panelHeight - tileGap * (rows - 1)) / rows);
    const generatedPanels = await Promise.all(
        /** Resizes each generated image and computes its grid position. */
        generatedImages.map(async (generatedImage, index) => {
            const row = Math.floor(index / columns);
            const column = index % columns;
            const input = await sharp(generatedImage)
                .rotate()
                .resize(tileWidth, tileHeight, {
                    fit: "contain",
                    background: "#ffffff",
                    withoutEnlargement: true,
                })
                .png()
                .toBuffer();

            return {
                input,
                left: padding + panelWidth + gap + column * (tileWidth + tileGap),
                top: padding + headerHeight + row * (tileHeight + tileGap),
            };
        }),
    );
    const beforeLabel = Buffer.from(
        `<svg width="${panelWidth}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg"><text x="4" y="38" fill="#252a27" font-family="Segoe UI, sans-serif" font-size="26" font-weight="600">Before</text></svg>`,
    );
    const afterLabel = Buffer.from(
        `<svg width="${panelWidth}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg"><text x="4" y="38" fill="#252a27" font-family="Segoe UI, sans-serif" font-size="26" font-weight="600">After${generatedImages.length ? ` (${generatedImages.length})` : ""}</text></svg>`,
    );
    const outputPath = path.join(tmpdir(), `image-comparison-${randomUUID()}.png`);

    await sharp({
        create: {
            width: padding * 2 + panelWidth * 2 + gap,
            height: padding * 2 + headerHeight + panelHeight,
            channels: 3,
            background: "#eceeea",
        },
    })
        .composite([
            { input: beforeLabel, left: padding, top: padding },
            { input: afterLabel, left: padding + panelWidth + gap, top: padding },
            { input: imagePanel, left: padding, top: padding + headerHeight },
            ...generatedPanels,
        ])
        .png()
        .toFile(outputPath);

    await open(outputPath, { wait: false });
    return outputPath;
}