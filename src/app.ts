
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ContentPartImage, ImageGenerationRequestOutputFormat } from "@openrouter/sdk/models";
import type {
  ImageGenerationRequestAspectRatio,
  ImageGenerationRequestQuality,
  ImageGenerationRequestResolution,
} from "@openrouter/sdk/models";
import type { ImageGenerationResponseData } from "@openrouter/sdk/models";
import { imageBufferToBase64, OutputDefinition, readImage, viewImageComparison } from "./images";
import { LOG_COLOR, log, startProgressBar, startSpinner } from "./logging";
import { OpenRouter } from "@openrouter/sdk";
import type { CreateImagesResponse } from "@openrouter/sdk/models/operations";

const openRouter = new OpenRouter({
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

const IMAGE_QUALITIES = ["auto", "low", "medium", "high", "xhigh", "max"] as const;
type ImageQuality = (typeof IMAGE_QUALITIES)[number];
const IMAGE_ASPECT_RATIOS = [
  "1:1", "1:2", "1:4", "1:8", "2:1", "2:3", "2.35:1", "3:2", "3:4", "4:1", "4:3", "4:5",
  "5:2", "5:4", "5:7", "7:5", "8:1", "9:16", "16:9", "9:19.5", "19.5:9", "9:20", "20:9", "9:21", "21:9", "auto",
] as const;
const IMAGE_RESOLUTIONS = ["512", "768", "1K", "2K", "4K"] as const;
const IMAGE_OUTPUT_FORMATS = ["png", "jpeg", "webp", "svg"] as const;

/** Sends the source image and its generation settings to OpenRouter. */
async function edit_image(
    base64Image: string,
  whatToRemove: string,
  outputDefinition: OutputDefinition,
): Promise<CreateImagesResponse> {
  const mediaType = outputDefinition.format === "jpg" ? "image/jpeg" : `image/${outputDefinition.format}`;
    const contentPart: ContentPartImage = {
    imageUrl: {
      url: `data:${mediaType};base64,${base64Image}`,
    },
    type: "image_url",
    };

  return await openRouter.images.generate({
    imageGenerationRequest: {
      model: "google/gemini-3-pro-image-preview",
      prompt: `Completely remove ${whatToRemove} in the scene. Cleanly reconstruct the background behind ${whatToRemove}, ensuring textures, lighting, and details perfectly match the surrounding environment. Leave all other objects, people, and details in the image completely untouched.`,
      ...(outputDefinition.resolution === undefined
        ? { size: `${outputDefinition.width}x${outputDefinition.height}` }
        : {}),
      quality: outputDefinition.quality,
      ...(outputDefinition.aspectRatio === undefined ? {} : { aspectRatio: outputDefinition.aspectRatio }),
      ...(outputDefinition.resolution === undefined ? {} : { resolution: outputDefinition.resolution }),
      inputReferences: [
        contentPart
      ],
      outputFormat: outputDefinition.outputFormat,
    },
  });


}

/** Decodes generated image data, saves each file, and returns buffers and paths. */
async function saveResponseImages(
    responseImages: ImageGenerationResponseData[],
    imagePath: string,
    outputDefinition: OutputDefinition,
): Promise<{ images: Buffer[]; paths: string[] }> {
    const inputFile = path.parse(imagePath);
    const generatedImages: Buffer[] = [];
    const outputPaths: string[] = [];
    if (responseImages.length === 0) {
      log("  No images were returned to save.", LOG_COLOR.warning);
      return { images: generatedImages, paths: outputPaths };
    }

    const progressBar = startProgressBar("Saving", responseImages.length);

    try {
      for (const [index, imageData] of responseImages.entries()) {
        const outputFilePath = path.join(
          inputFile.dir,
          `${inputFile.name}_edited_${index + 1}.${outputDefinition.outputFormat}`,
        );
        const imageBuffer = Buffer.from(imageData.b64Json, "base64");
        await writeFile(outputFilePath, imageBuffer);
        generatedImages.push(imageBuffer);
        outputPaths.push(outputFilePath);
        progressBar.increment();
      }
    } finally {
      progressBar.stop();
    }

    for (const outputFilePath of outputPaths) {
      log(`  ${outputFilePath}`, LOG_COLOR.muted);
    }
    return { images: generatedImages, paths: outputPaths };
}

/** Parses and validates optional image-generation settings from CLI arguments. */
function parseCliArguments(arguments_: string[]): {
  quality: ImageQuality;
  aspectRatio: ImageGenerationRequestAspectRatio | undefined;
  resolution: ImageGenerationRequestResolution | undefined;
  outputFormat: ImageGenerationRequestOutputFormat;
  noOutput: boolean;
} {
  let quality: ImageQuality = "high";
  let aspectRatio: ImageGenerationRequestAspectRatio | undefined;
  let resolution: ImageGenerationRequestResolution | undefined;
  let outputFormat: ImageGenerationRequestOutputFormat = "png";
  let noOutput = false;
  let qualityWasSet = false;
  let outputFormatWasSet = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--nooutput") {
      if (noOutput) throw new Error("The --nooutput option can only be specified once.");
      noOutput = true;
    } else if (argument === "--aspect-ratio" || argument.startsWith("--aspect-ratio=")) {
      const value = argument === "--aspect-ratio" ? arguments_[++index] : argument.slice("--aspect-ratio=".length);
      if (!IMAGE_ASPECT_RATIOS.includes(value as (typeof IMAGE_ASPECT_RATIOS)[number])) {
        throw new Error(`Invalid aspect ratio '${value}'. Choose: ${IMAGE_ASPECT_RATIOS.join(", ")}.`);
      }
      if (aspectRatio !== undefined) throw new Error("The --aspect-ratio option can only be specified once.");
      aspectRatio = value as ImageGenerationRequestAspectRatio;
    } else if (argument === "--resolution" || argument.startsWith("--resolution=")) {
      const value = argument === "--resolution" ? arguments_[++index] : argument.slice("--resolution=".length);
      if (!IMAGE_RESOLUTIONS.includes(value as (typeof IMAGE_RESOLUTIONS)[number])) {
        throw new Error(`Invalid resolution '${value}'. Choose: ${IMAGE_RESOLUTIONS.join(", ")}.`);
      }
      if (resolution !== undefined) throw new Error("The --resolution option can only be specified once.");
      resolution = value as ImageGenerationRequestResolution;
    } else if (
      argument === "--output-format" ||
      argument.startsWith("--output-format=") ||
      argument === "--format" ||
      argument.startsWith("--format=")
    ) {
      const option = argument.startsWith("--output-format") ? "--output-format" : "--format";
      const value = argument === option ? arguments_[++index] : argument.slice(`${option}=`.length);
      if (!IMAGE_OUTPUT_FORMATS.includes(value as (typeof IMAGE_OUTPUT_FORMATS)[number])) {
        throw new Error(`Invalid output format '${value}'. Choose: ${IMAGE_OUTPUT_FORMATS.join(", ")}.`);
      }
      if (outputFormatWasSet) throw new Error("The --format option can only be specified once.");
      outputFormat = value as ImageGenerationRequestOutputFormat;
      outputFormatWasSet = true;
    } else if (IMAGE_QUALITIES.includes(argument as ImageQuality)) {
      if (qualityWasSet) throw new Error("The quality option can only be specified once.");
      quality = argument as ImageQuality;
      qualityWasSet = true;
    } else {
      throw new Error(`Unexpected argument '${argument}'.`);
    }
  }

  return { quality, aspectRatio, resolution, outputFormat, noOutput };
}

/** Validates CLI options and runs the image editing workflow. */
async function main(): Promise<void> {
  const [filename, whatToRemoveArgument, ...arguments_] = process.argv.slice(2);
    if (!filename || !whatToRemoveArgument?.trim()) {
    throw new Error('Usage: npm start -- <image-file> "<what-to-remove>" [quality] [--format <png|jpeg|webp|svg>] [--aspect-ratio <ratio>] [--resolution <tier>] [--nooutput]');
    }
  const whatToRemove = whatToRemoveArgument.trim();
  const { quality, aspectRatio, resolution, outputFormat, noOutput } = parseCliArguments(arguments_);

    log("\nImage edit workflow", LOG_COLOR.info);
    log(`  Input: ${path.resolve(filename)}`, LOG_COLOR.muted);
    log("\n1/4  Loading and validating image", LOG_COLOR.info);
    const image = await readImage(filename);
    const base64Image = imageBufferToBase64(image);
    const { width, height } = image.metadata;
    if (width === undefined || height === undefined) {
      throw new Error("Image metadata does not include width and height.");
    }
    const outputDefinition = new OutputDefinition({
      width,
      height,
      quality,
      format: image.format,
      outputFormat,
      aspectRatio,
      resolution,
    });
    const sourceAspectRatio = image.aspectRatio === undefined ? "unknown" : image.aspectRatio.toFixed(3);
    log(
      `  Done  ${image.format.toUpperCase()} image ready (${image.width} x ${image.height}, ratio ${sourceAspectRatio}, ${image.buffer.byteLength.toLocaleString()} bytes)`,
      LOG_COLOR.success,
    );

    log("\n2/4  Generating edited image", LOG_COLOR.info);
    const generationSpinner = startSpinner("Waiting for image generation response");
    let response: CreateImagesResponse;
    try {
      response = await edit_image(base64Image, whatToRemove, outputDefinition);
      generationSpinner.succeed("Image generation complete");
    } catch (error) {
      generationSpinner.fail("Image generation failed");
      throw error;
    }
    if (!("data" in response)) {
      throw new Error("The image generation response was streamed; streaming image saves are not supported yet.");
    }

    log(`\n3/4  Saving ${response.data.length} generated image(s)`, LOG_COLOR.info);
    const savedImages = await saveResponseImages(response.data, image.imagePath, outputDefinition);
    log(`  Done  Saved ${savedImages.images.length} image(s)`, LOG_COLOR.success);

    if (noOutput) {
      log("\n4/4  Viewer skipped (--nooutput)", LOG_COLOR.info);
    } else {
      log("\n4/4  Opening comparison viewer", LOG_COLOR.info);
      const comparisonPath = await viewImageComparison(image, savedImages.images);
      log("  Done  Comparison opened", LOG_COLOR.success);
      log(`  Preview: ${comparisonPath}`, LOG_COLOR.muted);
    }

    console.log(savedImages.paths.join(","));
}

/** Reports workflow failures and marks the process as unsuccessful. */
main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    log(`\nError: ${message}`, LOG_COLOR.error);
    process.exitCode = 1;
});