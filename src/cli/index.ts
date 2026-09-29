import { ImageGenerationRequestOutputFormat } from "@openrouter/sdk/models";
import type {
    ImageGenerationRequestAspectRatio,
    ImageGenerationRequestQuality,
    ImageGenerationRequestResolution,
} from "@openrouter/sdk/models";

const IMAGE_QUALITIES = ["auto", "low", "medium", "high", "xhigh", "max"] as const;
type ImageQuality = (typeof IMAGE_QUALITIES)[number];
const IMAGE_ASPECT_RATIOS = [
    "1:1", "1:2", "1:4", "1:8", "2:1", "2:3", "2.35:1", "3:2", "3:4", "4:1", "4:3", "4:5",
    "5:2", "5:4", "5:7", "7:5", "8:1", "9:16", "16:9", "9:19.5", "19.5:9", "9:20", "20:9", "9:21", "21:9", "auto",
] as const;
const IMAGE_RESOLUTIONS = ["512", "768", "1K", "2K", "4K"] as const;
const IMAGE_OUTPUT_FORMATS = ["png", "jpeg", "webp", "svg"] as const;

export type CliOptions = {
    filename: string;
    whatToRemove: string;
    quality: ImageGenerationRequestQuality;
    aspectRatio: ImageGenerationRequestAspectRatio | undefined;
    resolution: ImageGenerationRequestResolution | undefined;
    outputFormat: ImageGenerationRequestOutputFormat;
    noOutput: boolean;
};

/** Prints the command syntax and supported options. */
function printHelp(): void {
    console.log(`TypeScript Images

Usage:
  npm start -- <image-file> "<what-to-remove>" [quality] [options]

Arguments:
  <image-file>       JPG, PNG, or WebP source image
  <what-to-remove>   Subject description inserted into the editing prompt
  [quality]          auto, low, medium, high, xhigh, or max (default: high)

Options:
  --output-format <format>  png, jpeg, webp, or svg (default: png)
  --aspect-ratio <ratio>    Requested aspect ratio (optional)
  --resolution <tier>       512, 768, 1K, 2K, or 4K (optional)
  --nooutput                Save results without opening the desktop viewer
  --help                    Show this help page

When --resolution is set, the source-dimension size is omitted from the request.
Generated file paths are printed as a comma-separated final line.`);
}

/** Parses positional arguments and validates optional image-generation settings. */
export function parseCliArguments(arguments_: string[]): CliOptions | undefined {
    if (arguments_.includes("--help")) {
        printHelp();
        return undefined;
    }

    const [filename, whatToRemoveArgument, ...options] = arguments_;
    if (!filename || !whatToRemoveArgument?.trim()) {
        throw new Error('Usage: npm start -- <image-file> "<what-to-remove>" [quality] [--output-format <png|jpeg|webp|svg>] [--aspect-ratio <ratio>] [--resolution <tier>] [--nooutput]');
    }

    let quality: ImageQuality = "high";
    let aspectRatio: ImageGenerationRequestAspectRatio | undefined;
    let resolution: ImageGenerationRequestResolution | undefined;
    let outputFormat: ImageGenerationRequestOutputFormat = "png";
    let noOutput = false;
    let qualityWasSet = false;
    let outputFormatWasSet = false;

    for (let index = 0; index < options.length; index += 1) {
        const argument = options[index];
        if (argument === "--nooutput") {
            if (noOutput) throw new Error("The --nooutput option can only be specified once.");
            noOutput = true;
        } else if (argument === "--aspect-ratio" || argument.startsWith("--aspect-ratio=")) {
            const value = argument === "--aspect-ratio" ? options[++index] : argument.slice("--aspect-ratio=".length);
            if (!IMAGE_ASPECT_RATIOS.includes(value as (typeof IMAGE_ASPECT_RATIOS)[number])) {
                throw new Error(`Invalid aspect ratio '${value}'. Choose: ${IMAGE_ASPECT_RATIOS.join(", ")}.`);
            }
            if (aspectRatio !== undefined) throw new Error("The --aspect-ratio option can only be specified once.");
            aspectRatio = value as ImageGenerationRequestAspectRatio;
        } else if (argument === "--resolution" || argument.startsWith("--resolution=")) {
            const value = argument === "--resolution" ? options[++index] : argument.slice("--resolution=".length);
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
            const value = argument === option ? options[++index] : argument.slice(`${option}=`.length);
            if (!IMAGE_OUTPUT_FORMATS.includes(value as (typeof IMAGE_OUTPUT_FORMATS)[number])) {
                throw new Error(`Invalid output format '${value}'. Choose: ${IMAGE_OUTPUT_FORMATS.join(", ")}.`);
            }
            if (outputFormatWasSet) throw new Error("The --output-format option can only be specified once.");
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

    return {
        filename,
        whatToRemove: whatToRemoveArgument.trim(),
        quality,
        aspectRatio,
        resolution,
        outputFormat,
        noOutput,
    };
}