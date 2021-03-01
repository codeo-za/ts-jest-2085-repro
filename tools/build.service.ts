/* tslint:disable:no-console */
import { configurations } from "./build.configs";
import chalk from "chalk";
import { COMMANDLINE_ERROR } from "./errno";
import * as Throttle from "promise-parallel-throttle";
import { spawn } from "./spawn";
import { SpawnOptions } from "child_process";
import * as which from "which";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { IFlavoredOverlayConfiguration, IOverlayConfiguration, Manifest, ManifestIcon } from "./interfaces";
// @ts-ignore
import debugGenerator from "debug";
import { hasFlag, popArgs } from "./args";
import { prompt } from "inquirer";

interface IHasInput {
    input: string;
}

const
    FALLBACK_OVERLAY = "le_default",
    FALLBACK_FLAVOR = "default",
    defaultProcessOptions = {
        stdio: "pipe",
        stderr: "pipe"
    } as Partial<SpawnOptions>,
    debug = debugGenerator("build.service"),
    WEB_CONFIG_FOR_HISTORY_MODE =
        `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="Handle History Mode and custom 404/500" stopProcessing="true">
          <match url="(.*)" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>`;

function yn(value: boolean) {
    return value
        ? chalk.greenBright("yes")
        : chalk.redBright("no ");
}

declare global {
    interface Array<T> {
        pushIf(value: T, condition: boolean | (() => boolean)): T[];
        append(value: T): T[];
    }

    interface Console {
        logLines(lines: string[], color?: string): void;
    }
}

console.logLines = function(lines: string[], color?: string) {
    const colorize = color && chalk[color]
        ? chalk[color].bind(chalk)
        : s => s;
    lines.forEach(line => {
        this.log(colorize(line));
    });
};

Array.prototype["push" + "If"] = function <T>(value: T, condition: () => boolean): T[] {
    const runCondition = typeof condition === "function"
        ? condition
        : () => condition;

    if (runCondition()) {
        this.push(value);
    }
    return this;
};

Array.prototype.append = function <T>(value: T): T[] {
    this.push(value);
    return this;
};

class BuildService {
    private _colors = [
        "cyanBright",
        "blueBright",
        "greenBright",
        "magentaBright",
        "yellowBright",
        "redBright",
        "whiteBright"
    ];
    private _stdout = process.stdout.write.bind(process.stdout);
    private _stderr = process.stderr.write.bind(process.stderr);

    private _usedColors = [];

    public get maxParallelJobs() {
        return this.minEnvNumber(
            ["MAX_CONCURRENCY", "MAX_PARALLEL_JOBS"],
            // leave 1 cpu overhead: I've noticed that even building a single
            // overlay uses more than one core
            os.cpus().length - 1
        );
    }

    public get cliService() {
        // TODO: search if not in path (npm should add local vue-cli-service to the path)
        const
            service = os.platform() === "win32" ? "vue-cli-service.cmd" : "vue-cli-service",
            inPath = which.sync(service, { nothrow: true });
        if (inPath) {
            return inPath;
        }
        const
            nodeModules = this._findNodeModules(),
            test = path.join(nodeModules, ".bin", service);
        if (fs.existsSync(test)) {
            return test;
        }
        throw new Error(`No ${ service } in ${ nodeModules }`);
    }

    private _findNodeModules() {
        const parts = process.cwd().split(path.sep);
        while (parts.length) {
            const test = path.join(...parts, "node_modules");
            if (fs.existsSync(test)) {
                return test;
            }
            parts.pop();
        }
        throw new Error(
            `Unable to find node_modules in, or travelling up from ${ process.cwd() }`
        );
    }

    public async test() {
        if (this._showedHelp([
            "Usage: test",
            "Environment variables:",
            "   JEST_MAX_WORKERS",
            `     - default: ${ this.maxParallelJobs }`,
            "     - how many workers to spawn when running in parallel",
            "     - defaults to the number of cores on your machine",
            "     - setting higher than this number is a Bad Idea",
            "     - setting lower may allow timing-based tests to pass easier",
            "     - setting lower will probably slow test runs, with less load on your machine",
            "     - set to a negative number to imply NUM_CPUS - x",
            "     - overridden by MAX_CONCURRENCY",
            "   JEST_RUN_IN_BAND",
            "     - default: OFF",
            "     - runs tests \"in band\", meaning they are not run in parallel",
            "     - significantly slower run time",
            "     - may be required on slower machines where timing-based tests flop",
            "     - negates any JEST_MAX_WORKERS value (in-band _always_ means 1 worker)",
            "   JEST_SKIP_COVERAGE",
            "     - default: ON",
            "     - whether or not to skip coverage generation",
            "     - may speed up tests, but you'll get no build reports",
            "   JEST_USE_CACHE",
            "     - default: OFF",
            "     - whether or not to use the jest cache during tests",
            "     - using jest cache can speed up tests significantly",
            "     - using the jest cache also often causes false failures",
            "Truthy values considered for switching these flags on (case-insensitive):",
            " - 1",
            " - on",
            " - true",
            " - yes",
            " - yebo"
        ])) {
            return;
        }
        const
            collectCoverage = !this.envFlag("JEST_SKIP_COVERAGE", true),
            useCache = this.envFlag("JEST_USE_CACHE"),
            runInBand = this.envFlag("JEST_RUN_IN_BAND"),
            maxWorkers = this.minEnvNumber(["MAX_CONCURRENCY", "JEST_MAX_WORKERS"], this.maxParallelJobs),
            args = ["test:unit"]
                .pushIf("--collectCoverage", collectCoverage)
                .pushIf("--no-cache", !useCache)
                .pushIf("--runInBand", runInBand);
        if (runInBand) {
            if (process.env.JEST_MAX_WORKERS !== undefined ||
                process.env.MAX_CONCURRENCY !== undefined) {
                console.warn("-- ignoring JEST_MAX_WORKERS / MAX_CONCURRENCY: JEST_RUN_IN_BAND is set");
            }
        } else {
            args.push("--maxWorkers");
            args.push(maxWorkers.toString());
        }
        if (!!process.env.JEST_MAX_WORKERS &&
            !!process.env.MAX_CONCURRENCY) {
            console.warn(`WARNING: MAX_CONCURRENCY (${
                process.env.MAX_CONCURRENCY
            }) caps JEST_MAX_WORKERS (${
                process.env.JEST_MAX_WORKERS
            })`);
        }
        const opts = this._createSpawnOptionsFor({
            OVERLAY: FALLBACK_OVERLAY,
            FLAVOR: "",
            NODE_ENV: process.env.NODE_ENV || "debug",
            JEST_JUNIT_OUTPUT_DIR: "buildreports"
        });
        console.logLines([
            "Running tests with settings:",
            `  collecting coverage: ${ yn(collectCoverage) }  ${ this._showEnv("JEST_SKIP_COVERAGE") }`,
            `  using jest cache:    ${ yn(useCache) }  ${ this._showEnv("JEST_USE_CACHE") }`,
            `  running in band:     ${ yn(runInBand) }  ${ this._showEnv("JEST_RUN_IN_BAND") }`,
            `  max workers:         ${ chalk.cyanBright(runInBand ? "1" : maxWorkers.toString()) }    ${
                this._showEnv("JEST_MAX_WORKERS")
            } ${
                this._showEnv("MAX_CONCURRENCY")
            }`
        ], "yellowBright");
        return await spawn(
            this.cliService,
            args,
            opts
        );
    }

    private dumpEnv(name: string) {
        return process.env[name] === undefined
            ? name
            : `${ name } (${ process.env[name] })`;
    }

    private minEnvNumber(name: string | string[], fallback: number) {
        const names = Array.isArray(name)
            ? name
            : [name],
            values = names.map(n => this.envNum(n, fallback));
        return values.reduce((acc, cur) => acc > cur ? cur : acc);
    }

    private _showEnv(envVar: string) {
        const val = process.env[envVar] === undefined
            ? "not set"
            : JSON.stringify(process.env[envVar]);
        return chalk.grey(`    [${ envVar }] is ${ val }`);
    }

    private envNum(name: string | string[], fallback: number): number {
        if (!Array.isArray(name)) {
            name = [name];
        }
        const firstDefined = this.findFirstDefinedEnvVar(name),
            value = process.env[firstDefined],
            parsed = parseInt(value, 10);
        return isNaN(parsed)
            ? fallback
            : parsed;
    }

    private findFirstDefinedEnvVar(names: string[]): string {
        return names.reduce(
            (acc, cur) => !!acc ? acc : (!!process.env[cur] ? cur : acc),
            null as string
        ) || names[0];
    }

    private envFlag(name: string, defaultValue: boolean = false): boolean {
        const value = process.env[name];
        if (!value) {
            return defaultValue;
        }
        return [
            "true", "yes", "1", "on", "yebo"
        ].indexOf(value.toLowerCase()) > -1;
    }

    private _showedHelp(lines: string[]): boolean {
        const
            args = process.argv.slice(2),
            shouldShow = args.indexOf("-h") > -1 ||
                args.indexOf("--help") > -1;
        if (!shouldShow) {
            return false;
        }
        console.logLines(lines);
        return true;
    }

    private _createSpawnOptionsFor(envVars: object) {
        // it appears that `spawn` behaves differently on OSX than on
        //  windows: on windows, provided environment variables are
        //  merged into the parent process' environment variables, where
        //  `spawn` on OSX appears to use _only_ the environment variables
        //  which are provided. This can lead to esoteric errors like
        //  "env: node: No such file or directory"
        return Object.assign({}, defaultProcessOptions, {
            env: Object.assign({}, process.env, envVars)
        });
    }

    public async build(): Promise<number> {
        const
            args = process.argv.slice(2),
            overlays = this.selectOverlaysFrom(args);

        const promises = [];
        for (const overlay of overlays) {
            const
                outputColor = this._randomColor(),
                pre = `[build::${ overlay.replace(/_default$/, "") }]`,
                overlayParts = overlay.split("_"),
                overlayName = overlayParts[0],
                overlayFlavor = overlayParts[1],
                prefix = `${ chalk[outputColor](pre) }`,
                opts = this._createSpawnOptionsFor({
                    OVERLAY: overlayName,
                    FLAVOR: overlayFlavor || "default",
                    NODE_ENV: process.env.NODE_ENV || "production"
                }),
                requiresWebConfig = !!process.env.CREATE_WEB_CONFIG;
            opts.env.VUE_APP_API_DOMAIN = this.determineApiDomainFor(overlay);
            promises.push(
                async () => {
                    this.info(`now building: ${ overlay.replace(/_default$/, "") }`);
                    const cliArgs = ["build", "--modern"];
                    if (process.env.REPORT_VUE_BUILD) {
                        cliArgs.push("--report");
                    }
                    const buildResult = await spawn(
                        this.cliService,
                        cliArgs,
                        opts,
                        s => this._writeStdoutLine(prefix, s),
                        s => this._writeStderrLine(prefix, s)
                    );
                    if (buildResult) {
                        return buildResult;
                    }
                    try {
                        await this._writeManifestFor(overlay);
                        if (requiresWebConfig) {
                            await this._writeWebConfigFor(overlay);
                        }
                    } catch (e) {
                        return -1;
                    }
                }
            );
        }
        const maxJobs = this.maxParallelJobs;
        console.log(chalk.yellowBright(`building ${
            promises.length
        } overlay/flavor combos, max ${
            maxJobs
        } at a time [ ${
            this.dumpEnv("MAX_PARALLEL_JOBS")
        } | ${
            this.dumpEnv("MAX_CONCURRENCY")
        } ]`));
        const
            started = new Date(),
            allResults = await Throttle.all(promises, {
                failFast: true,
                maxInProgress: maxJobs
            }),
            result = (allResults as number[]).reduce((acc, cur) => {
                if (cur === 0) {
                    return 0;
                }
                return acc;
            }, 0),
            ended = new Date(),
            totalSeconds = Math.round((ended.getTime() - started.getTime()) / 1000),
            averageSeconds = totalSeconds / allResults.length,
            totalTime = toHumanReadableTime(totalSeconds),
            averageTime = toHumanReadableTime(parseFloat(averageSeconds.toFixed(2)));
        console.log(`built ${ allResults.length } sites in ${ totalTime } (av ${averageTime})`);
        return result;
    }

    private _writeWebConfigFor(overlay: string) {
        const
            // FIXME: should accept a flavor as a parameter
            config = configurations[overlay].default,
            target = path.join(config.distributionDirectory, "web.config");
        return new Promise((resolve, reject) => {
            fs.writeFile(target, WEB_CONFIG_FOR_HISTORY_MODE, { encoding: "utf-8" }, (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }

    private _writeManifestFor(overlay: string) {
        // perhaps make this async? requires promisifying fs.(read|write)File
        const
            // FIXME: should accept a flavor as a parameter
            config = configurations[overlay].default,
            manifest: Manifest = {
                name: config.pwaPromptEnabled ? config.title : null,
                short_name: config.pwaPromptEnabled ? config.title : null,
                theme_color: config.pwaConfig.themeColor,
                background_color: config.pwaConfig.backgroundColor || config.pwaConfig.themeColor,
                icons: [
                    this._findIcon(config, 48),
                    this._findIcon(config, 72),
                    this._findIcon(config, 96),
                    this._findIcon(config, 144),
                    this._findIcon(config, 192)
                ].filter(o => !!o),
                scope: "",
                orientation: "portrait",
                display: "fullscreen",
                start_url: "index.html"
            },
            target = path.join(config.distributionDirectory, "manifest.json"),
            existingContents = fs.existsSync(target)
                ? fs.readFileSync(target, { encoding: "utf-8" })
                : "{}",
            existing = JSON.parse(existingContents),
            finalManifest = { ...existing, ...manifest };
        fs.writeFileSync(
            target,
            JSON.stringify(finalManifest, null, 2),
            { encoding: "utf-8" });
    }

    private _iconCache = {};

    private _findIcon(config: IOverlayConfiguration, size: number): ManifestIcon {
        this.debug("looking for icon", {
            overlay: config.name,
            size
        });
        if (!this._iconCache[config.name]) {
            this._iconCache[config.name] = this._findAllPngsUnder(config.distributionDirectory);
            this.debug("cached icon paths", this._iconCache);
        }
        const
            sizes = `${ size }x${ size }`,
            re = new RegExp(sizes),
            result = this._iconCache[config.name].filter(
                p => {
                    const match = !!p.match(re);
                    this.debug({
                        overlay: config.name,
                        size,
                        iconPath: p,
                        re,
                        match
                    });
                    return match;
                })[0];
        if (!result) {
            return undefined;
        }
        const relative = path.relative(config.distributionDirectory, result).replace(/\\/g, "/");
        this.debug({
            result,
            base: config.projectBase,
            relative
        });
        return {
            sizes,
            type: "image/png",
            src: relative
        };
    }

    private _findAllPngsUnder(dir): string[] {
        return fs.readdirSync(dir).reduce((acc: string[], cur: string) => {
            const
                fullPath = path.join(dir, cur).replace(/\\/g, "/"),
                st = fs.statSync(fullPath);
            if (st.isDirectory()) {
                const subs = this._findAllPngsUnder(fullPath);
                acc.push.apply(acc, subs);
                return acc;
            }
            const re = /.*\/img\/icons\/.*\.png$/;
            if (fullPath.match(re)) {
                acc.push(fullPath);
            }
            return acc;
        }, []);
    }

    private _writeStdoutLine(prefix: string, line: string) {
        this._write(this._stdout, prefix, line);
    }

    private _writeStderrLine(prefix: string, line: string) {
        this._write(this._stderr, prefix, line);
    }

    private _write(writer, prefix, line: string) {
        writer(`${ prefix }${ line }\n`);
    }

    public async serve() {
        const
            args = Array.from(process.argv.slice(2)),
            noArgs = args.slice().length === 0;
        const showHelp = hasFlag(args, "-h", "--help");
        if (showHelp) {
            this._showServeHelp();
            return;
        }
        if (noArgs) {
            // default to interactive mode
            args.push("-i");
        }
        const useLocal = hasFlag(args, "-l", "--local");
        if (useLocal) {
            process.env.LOCAL_API = "1";
        }
        let
            userDomain = popArgs(args, "--domain")[0],
            cliOverlay = popArgs(args, "--overlay")[0] || args[0];  // remaining args should be overlay name
        if (cliOverlay) {
            if (cliOverlay.indexOf("_") === -1) {
                cliOverlay = `${ cliOverlay }_default`;
            }
            const overlayName = cliOverlay.split("_")[0];
            if (!userDomain) {
                userDomain = useLocal
                    ? `${ overlayName }.dev.local`
                    : `${ overlayName }.demo_site.com`;
            }
        }
        let userOverlay = cliOverlay ? [cliOverlay] : [];
        if (noArgs || hasFlag(args, "-i", "--interactive")) {
            if (noArgs) {
                console.log(
                    chalk.yellowBright(
                        "Entering interactive mode.\nRun 'npm start -- --help' for other options\n\n"
                    )
                );
            }
            const { overlay, flavor, apiDomain } = await this.readInteractiveUserSelections();
            userDomain = apiDomain;
            userOverlay = [`${ overlay }_${ flavor }`];
        }

        const
            overlays = userOverlay || this.selectOverlaysFrom(args),
            promises = overlays.map(async (selectedOverlay) => {
                this.info(`serving: ${ selectedOverlay }`);
                const [overlay, flavor] = selectedOverlay.split("_");
                const
                    backendDomain = userDomain || this.determineApiDomainFor(overlay),
                    backend = `https://${ backendDomain }`,
                    opts = Object.assign({}, defaultProcessOptions, {
                        env: Object.assign({}, process.env, {
                            OVERLAY: overlay,
                            FLAVOR: flavor || "default",
                            NODE_ENV: process.env.NODE_ENV || "development",
                            VUE_APP_API_ENDPOINT:
                                process.env.VUE_APP_API_ENDPOINT || `${ backend }/management/api/`,
                        })
                    });

                this.info(`environment: ${ opts.env.NODE_ENV }`);
                this.info(`flavour: ${ opts.env.FLAVOR }`);
                this.info(`backend url: ${ opts.env.VUE_APP_API_ENDPOINT }`);
                await spawn(
                    this.cliService,
                    ["serve"],
                    opts);
            });
        await Promise.all(promises);
    }

    private async readInteractiveUserSelections() {
        const
            overlay = await this.queryOverlay(),
            flavor = await this.queryFlavor(overlay),
            apiDomain = await this.queryApiDomain(overlay);
        return {
            overlay,
            flavor,
            apiDomain
        };
    }

    private async queryOverlay(): Promise<string> {
        return this.askWithChoices(
            "Select overlay",
            Object.keys(configurations)
        );
    }

    private async queryFlavor(forOverlay: string): Promise<string> {
        const
            config = configurations[forOverlay],
            available = Object.keys(config),
            withoutDefault = available.filter(o => o !== "default"),
            withDefaultFirst = ["default"].concat(withoutDefault);
        return this.askWithChoices("Select flavor", withDefaultFirst);
    }

    private async askWithChoices(
        question: string,
        choices: string[]
    ): Promise<string> {
        const userInput = (await prompt({
            name: "input",
            message: question,
            type: "list",
            choices
        })) as IHasInput;
        return userInput.input;
    }

    private async askWithDefault(
        question: string,
        fallback: string
    ): Promise<string> {
        const userInput = (await prompt({
            name: "input",
            message: question,
            default: fallback
        })) as IHasInput;
        return userInput.input;
    }

    private async queryApiDomain(overlay: string): Promise<string> {
        const selected = await this.askWithChoices(
            "Which domain should be used for api?", [
                this.devLocalFor(overlay),
                this.demoSiteFor(overlay),
                "custom"
            ]
        );
        if (selected === "custom") {
            return this.askWithDefault(
                "Which domain should be used for api?",
                this.devLocalFor(overlay)
            );
        } else {
            return selected;
        }
    }

    private _showServeHelp() {
        const
            y = chalk.yellowBright.bind(chalk),
            c = chalk.cyanBright.bind(chalk);
        [
            `Phoenix serve help:`,
            `  run with ${ y("-- -i") } or ${ y("-- --interactive") } to enter interactive mode`,
            `    (leading ${ y("--") } is so that npm doesn't eat your arguments)`,
            `  ${ c("OR") }`,
            `  to serve, run a command like: 'npm start le_default'`,
            `    for the default flavor, or 'npm start le_default-en'`,
            `    for the Botswana english flavor`,
            `  - this starts a local web server with the le_default overlay`,
            `    using le_default.demo_site.com for api requests`,
            `  you may override api hosts with the following environment variables:`,
            `  - ${ y("LOCAL_API") }`,
            `    - use {overlay}.dev.local for all api requests`,
            `  - ${ y("VUE_APP_API_ENDPOINT") }`,
            `    - use this url as the base for all api requests`,
            `    - should probably end in  '/api'`,
            `  Available overlays & flavors:`,
            `  - ${ this.listAllOverlaysAndFlavors().join("\n  - ") }`
        ].forEach(line => console.log(line));
        return true;
    }

    private listAllOverlaysAndFlavors(): string[] {
        const overlays = Object.keys(configurations);
        return overlays.map(o => `${ o } (${ Object.keys(configurations[o]).join(",") })`);
    }

    public listAllOverlays(): string[] {
        return Object.keys(configurations);
    }

    private determineApiDomainFor(overlay) {
        if (process.env.LOCAL_API) {
            return this.devLocalFor(overlay);
        }
        return process.env.VUE_APP_API_DOMAIN || `${ overlay }.demo_site.com`;
    }

    private devLocalFor(overlay: string) {
        return `${ overlay }.dev.local`;
    }

    private demoSiteFor(overlay: string) {
        return `${ overlay }.demo_site.com`;
    }

    private _randomColor() {
        if (this._colors.length === 0) {
            this._colors = this._usedColors.splice(0, this._usedColors.length);
        }
        const
            idx = Math.floor(Math.random() * this._colors.length),
            selected = this._colors.splice(idx, 1)[0];
        this._usedColors.push(selected);
        return selected;
    }

    public get selectedOverlayConfig(): IOverlayConfiguration {
        if (this._selectedOverlayConfig) {
            return this._selectedOverlayConfig;
        }
        let overlay = FALLBACK_OVERLAY;
        let flavor = FALLBACK_FLAVOR;
        const environmentOverlay = (process.env.OVERLAY || "").toLowerCase();
        const environmentFlavor = (process.env.FLAVOR || "").toLowerCase();
        if (environmentOverlay &&
            configurations[environmentOverlay] &&
            this.hasFlavor(configurations[environmentOverlay], environmentFlavor)) {
            overlay = environmentOverlay;
            flavor = this._resolveFlavorCase(configurations[overlay], environmentFlavor);
        } else if (environmentOverlay || environmentFlavor) {
            if (configurations[environmentOverlay]) {
                this.error(`overlay ${ environmentOverlay } has no flavor ${ environmentFlavor }`);
            } else {
                this.error(`overlay not found: ${ environmentOverlay }`);
            }
            process.exit(1);
        }
        return this._selectedOverlayConfig = configurations[overlay][flavor];
    }

    private hasFlavor(
        configuration: IFlavoredOverlayConfiguration,
        flavor: string): boolean {
        if (!configuration) {
            return false; // can't have flavors on nothing
        }
        if (!flavor) {
            return true; // implies 'default'
        }
        return !!this._resolveFlavorCase(configuration, flavor);
    }

    private _resolveFlavorCase(
        configuration: IFlavoredOverlayConfiguration,
        flavor: string): string {
        if (!flavor) {
            return "default";
        }
        return Object.keys(configuration)
            .find(k => k.toLowerCase() === flavor.toLowerCase());
    }

    private _selectedOverlayConfig;

    private selectOverlaysFrom(args: string[]): string[] {
        const allPermutations = this._generateAllOverlaysAndFlavors();
        if (args.length === 0) {
            return allPermutations;
        }
        args = args.map(s => {
            const parts = s.split("_");
            parts[0] = parts[0].toLowerCase();
            return parts.join("_");
        });
        if (args.filter(o => o === "all")[0]) {
            this.info("selecting all overlays, all flavors...");
            return allPermutations;
        }
        if (args.length > 0) {
            const invalid = args
                .filter(a => {
                    return allPermutations.indexOf(a.replace(/_default$/, "")) === -1;
                }); // find missing keys
            if (invalid.length) {
                console.error(`overlay${
                    invalid.length === 1 ? "" : "s"
                } not found: ${ invalid.join(", ") }`);
                process.exit(COMMANDLINE_ERROR);
            }
            return args;
        }
    }

    private _generateAllOverlaysAndFlavors(): string[] {
        const overlays = Object.keys(configurations);
        return overlays.reduce((acc, overlay) => {
            const flavors = Object.keys(configurations[overlay]);
            return acc.concat(
                flavors.map(
                    flavor => flavor === "default"
                        ? overlay
                        : `${ overlay }_${ flavor }`
                )
            );
        }, [] as string[]);
    }

    // noinspection JSUnusedLocalSymbols
    private debug(...args) {
        debug.apply(null, args);
    }

    private info(...args) {
        this.log(
            console.info,
            chalk.yellow,
            args
        );
    }

    // noinspection JSUnusedLocalSymbols
    private error(...args) {
        this.log(
            console.error,
            chalk.red,
            args
        );
    }

    private log(consoleFn, colorFn, args) {
        this.format(args, colorFn);
        consoleFn.apply(console, args);
    }

    private format(args, colorFn) {
        args[0] = `[${ chalk.magenta("build service") }] ${ colorFn(args[0]) }`;
    }

    public async updateOverlayRegisterScript(masterOverlay: string) {
        const
            overlays = Object.keys(configurations);
        if (!masterOverlay) {
            throw new Error("Please select a master overlay to distribute register.ts from");
        }
        const match = overlays.find(o => o.toLowerCase() === masterOverlay.toLowerCase());
        if (!match) {
            throw new Error(`No such overlay: ${ masterOverlay }`);
        }

        const src = this._generateRegisterScriptPathFor(match);
        if (!fs.existsSync(src)) {
            throw new Error(`Can't find source register.ts at: ${ src }`);
        }
        const targets = overlays.filter(o => o !== match);
        let failed = 0;
        console.log(
            chalk.yellow(`Updating overlay register.ts files from master:`) +
            chalk.red(` ${ masterOverlay }`)
        );
        targets.forEach(overlay => {
            const target = this._generateRegisterScriptPathFor(overlay);
            try {
                this._startStatus(`updating ${ overlay }/register.ts...`);
                fs.copyFileSync(src, target);
                this._successStatus();
            } catch (e) {
                this._failStatus();
                failed++;
            }
        });
        if (failed) {
            throw new Error(`${ failed } overlays not updated`);
        }
    }

    private _startStatus(msg: string) {
        process.stdout.write(`${ " ".repeat(7) }${ msg }`);
    }

    private _successStatus() {
        process.stdout.write(chalk.green("\r[ OK ]"));
        console.log("");
    }

    private _failStatus() {
        process.stdout.write(chalk.red("\r[FAIL]"));
        console.log("");
    }

    private _generateRegisterScriptPathFor(overlay: string) {
        return path.join("src", "overlays", overlay, "register.ts");
    }
}

export function toHumanReadableTime(totalSeconds: number) {
    const
        seconds = totalSeconds % 60,
        minutes = Math.floor(totalSeconds / 60),
        hours = Math.floor(totalSeconds / 3600);

    const parts = [];
    if (hours) {
        parts.push(hours.toString());
    }

    if (minutes || parts.length) {
        parts.push(pad(minutes));
    }

    if (parts.length) {
        parts.push(pad(seconds));
        return parts.join(":");
    } else {
        return `${ seconds }s`;
    }

    function pad(num: number): string {
        return num < 10
            ? `0${ num }`
            : num.toString();
    }
}


export const buildService = new BuildService();

