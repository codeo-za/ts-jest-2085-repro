hijackConsole();
// jsdom is missing a crypto object and node-uuid really, really wants one
// -> make it so!
import getRandomValues from "polyfill-crypto.getrandomvalues";
import fs from "fs";
import path from "path";
import { registerComponents } from "@/register-components";
import { Vue, VueConstructor } from "vue/types/vue";
import axios from "axios";

window["cry" + "pto"] = window.crypto || {
    getRandomValues
};

// env.ts refers to these constants which are set by webpack from environment variables
// tslint:disable-next-line:no-string-literal
// @ts-ignore
window.OVERLAY = "le_default";
// @ts-ignore
window.FLAVOR = "default";
// @ts-ignore
window.ENVIRONMENT = "debug";
// @ts-ignore
window.URL = {
    createObjectURL: jest.fn()
};

function lsR(dir: string, match: RegExp) {
    const intermediate = fs.readdirSync(dir)
        .map(p => {
            const fullPath = path.join(dir, p);
            return {
                fullPath,
                isDir: fs.statSync(fullPath).isDirectory()
            };
        })
        .filter(p => {
            return p.isDir || !!p.fullPath.match(match);
        });
    return intermediate.reduce(
        (acc, cur) => {
            if (cur.isDir) {
                acc.push.apply(acc, lsR(cur.fullPath, match));
            } else {
                acc.push(cur.fullPath);
            }
            return acc;
        }, [] as string[]);
}

const alreadyRegistered = [];

export function registerAllComponents(
    selectedOverlay?: string,
    vue?: VueConstructor<Vue>,
    onlyLoadPaths?: string[],
    debugRegistration?: boolean) {

    if (alreadyRegistered.indexOf(vue) > -1) {
        return;
    }
    alreadyRegistered.push(vue);
    const srcDir = path.join(__dirname, "../src/components");
    const paths = lsR(`${ srcDir }`, /vue$/);
    // @ts-ignore
    // noinspection TypeScriptUnresolvedVariable
    const overlay = selectedOverlay || window.OVERLAY;
    registerComponents(
        overlay,
        paths,
        [],
        require,
        vue,
        onlyLoadPaths,
        debugRegistration);
}

process.on("unhandledRejection", err => {
    logRejection(err, true);
});

function logRejection(err, showHeader?: boolean) {
    if (showHeader) {
        logError(`Unhandled promise rejection`);
    }
    logError((err || "Unknown error").toString());
    const e = (err || {}) as Error;
    if (e.stack) {
        logError(e.stack);
    } else {
        logError("Error has no stack! Dumping all we have...");
        logError(JSON.stringify(e));
    }
}

function stringify(o) {
    if (o === null) {
        return "(null)";
    }
    if (o === undefined) {
        return "(undefined)";
    }
    if (Array.isArray(o)) {
        return o.map(stringify).join(",");
    }
    try {
        return o.toString();
    } catch (e) {
        return "- wat -";
    }
}

function logError(...args) {
    const
        logFile = generateLogFileName(),
        parts = args.map(stringify).concat(["\n"]),
        line = parts.join("");
    process.stdout.write(line);
    fs.appendFileSync(
        logFile,
        line,
        { encoding: "utf8" }
    );
}

let cachedFileName = null;

function generateLogFileName() {
    if (cachedFileName) {
        return cachedFileName;
    }
    const
        dir = "async-errors",
        logFile = `${ dir }/${ whatSpec() }.log`;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    return cachedFileName = logFile;
}

function whatSpec() {
    // this is only really reliable when not running in-band
    const
        recorded = global["__SPEC" + "FILE__"] || "Unknown",
        parts = recorded.split(/[\\\/]/g);
    return parts[parts.length - 1];
}


function hijackConsole() {
    const originals = {
        warn: console.warn,
        info: console.info,
        debug: console.debug
    };

    Object.keys(originals).forEach(k => {
        console[k] = (...args: any[]) => {
            if (shouldSuppress(args)) {
                return true;
            }
            originals[k].call(console, ...args);
        };
    });
}

const suppressed = [
    // no-one seems to be bothered to ensure tests are set up with
    //  relative routing intact. This may break later on...
    "[vue-router] relative params navigation requires a current route",
    // of course we're in dev mode for tests :|
    "You are running Vue in development mode"
];

function shouldSuppress(...args: any[]) {
    const all = args.join(" ");
    return shouldSuppressMessage(all);
}

function shouldSuppressMessage(message: string) {
    return suppressed.reduce(
        (acc, cur) => acc || message.toLowerCase().indexOf(cur.toLowerCase()) > -1,
        false
    );
}

process.env.VUE_APP_IMAGE_RESIZE_SERVICE_URL = process.env.VUE_APP_IMAGE_RESIZE_SERVICE_URL || "http://image-resizer.foo";

// machines under load may need a little more time for complex
// components like checkout to complete testing
jest.setTimeout(10000);
let timeout = parseInt(process.env.JEST_TIMEOUT, 10);
if (isNaN(timeout)) {
    timeout = 10000;
}
jest.setTimeout(timeout);

beforeEach(() => {
    ["get", "post", "patch", "put", "delete"].forEach(verb => {
        spyOn(axios, verb as any).and.callFake((...args: any[]) => {
            throw new Error([
                    `should not be making ANY real web calls during tests!`,
                    `web call was: ${ verb }`,
                    `with args:`,
                    `${ args.join("\n") }`
                ].join("\n")
            );
        });
    });
});
