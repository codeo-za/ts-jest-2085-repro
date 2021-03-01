import { EOL } from "os";
import chalk from "chalk";
import { spawn as cp_spawn, SpawnOptions } from "child_process";
import { createInterface } from "readline";
const debug = require("debug")("spawn");

function writeStdOutLine(line: string) {
    process.stdout.write(`${ chalk.yellowBright(line) }${ EOL }`);
}

function writeStdErrLine(line: string) {
    if (!line) {
        return;
    }
    if (looksLikeWebPackProgress(line)) {
        return process.stdout.write(`\r${ chalk.white(limit(line, 60)) }`);
    }
    if (looksLikeError(line)) {
        return process.stdout.write(`${ chalk.red(line) }${ EOL }`);
    }
    if (looksLikeTestPassing(line)) {
        return process.stdout.write(`${ chalk.green(line) }${ EOL }`);
    }
    process.stdout.write(`${ chalk.cyanBright(line) }${EOL}`);
}

function limit(line: string, max: number) {
    return line.length <= max
        ? line + " ".repeat(max - line.length)
        : line.substr(0, max - 3) + "...";
}

function looksLikeWebPackProgress(line) {
    return !!line.match(/\[webpack.Progress]/);
}

function looksLikeTestPassing(s: string): boolean {
    return !!s.match(/^PASS/);
}

function looksLikeError(s: string): boolean {
    return !!s.match(/^FAIL/) ||
        !!s.match(/^error/i) ||
        !!s.match(/^\s*console.error/);
}

function setupLineBufferedWriter(stream, writerFn) {
    const rl = createInterface({ input: stream });
    rl.on("line", writerFn);
}

export type LoggerFn = (line: string) => void;

export async function spawn(
    cmd: string,
    args: string[],
    options: SpawnOptions,
    stdoutWriter?: LoggerFn,
    stderrWriter?: LoggerFn): Promise<number> {

    debug({
        cmd,
        args,
        options,
        stdoutWriter,
        stderrWriter
    });
    return new Promise<number>((resolve, reject) => {
        const proc = cp_spawn(cmd, args, options);
        setupLineBufferedWriter(proc.stdout, stdoutWriter || writeStdOutLine);
        setupLineBufferedWriter(proc.stderr, stderrWriter || writeStdErrLine);
        proc.on("error", err => {
            reject(err);
        });
        proc.on("close", code => {
            if (code) {
                return reject(code);
            }
            resolve(0);
        });
    });
}

