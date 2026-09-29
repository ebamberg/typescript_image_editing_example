import type {
    ImageGenerationRequestAspectRatio,
    ImageGenerationRequestOutputFormat,
    ImageGenerationRequestQuality,
    ImageGenerationRequestResolution,
} from "@openrouter/sdk/models";
import type { ImageFormat } from "./index";

export type OutputDefinitionOptions = {
    width: number;
    height: number;
    quality: ImageGenerationRequestQuality;
    format: ImageFormat;
    outputFormat: ImageGenerationRequestOutputFormat;
    aspectRatio?: ImageGenerationRequestAspectRatio;
    resolution?: ImageGenerationRequestResolution;
};

export class OutputDefinition implements OutputDefinitionOptions {
    readonly width: number;
    readonly height: number;
    readonly quality: ImageGenerationRequestQuality;
    readonly format: ImageFormat;
    readonly outputFormat: ImageGenerationRequestOutputFormat;
    readonly aspectRatio?: ImageGenerationRequestAspectRatio;
    readonly resolution?: ImageGenerationRequestResolution;

    /** Captures validated source and generation settings for one image request. */
    constructor(options: OutputDefinitionOptions) {
        this.width = options.width;
        this.height = options.height;
        this.quality = options.quality;
        this.format = options.format;
        this.outputFormat = options.outputFormat;
        this.aspectRatio = options.aspectRatio;
        this.resolution = options.resolution;
    }
}