import chalk from "chalk";
import cliProgress from "cli-progress";
import ora from "ora";

export const LOG_COLOR = {
    info: "cyan",
    success: "green",
    muted: "gray",
    warning: "yellow",
    error: "red",
} as const;

type LogColor = (typeof LOG_COLOR)[keyof typeof LOG_COLOR];

/** Prints a message using one of the shared terminal colors. */
export function log(text: string, color: LogColor = LOG_COLOR.info): void {
    console.log(chalk[color](text));
}

/** Starts a spinner for an operation with no incremental progress updates. */
export function startSpinner(text: string) {
    return ora({ text, color: LOG_COLOR.info }).start();
}

/** Starts the shared progress bar for saving generated images. */
export function startProgressBar(label: string, total: number) {
    const progressBar = new cliProgress.SingleBar({
        format: `  ${chalk[LOG_COLOR.info](label)} [{bar}] {value}/{total} images`,
        barCompleteChar: "█",
        barIncompleteChar: "░",
        hideCursor: true,
        clearOnComplete: false,
    }, cliProgress.Presets.shades_classic);
    progressBar.start(total, 0);
    return progressBar;
}