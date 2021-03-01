import * as fs from "fs";
import * as path from "path";
import { FAILURE } from "./errno";
import { OverlayConfiguration, overlayBase } from "./overlay-configuration";
import { IOverlayConfigurations } from "./interfaces";

if (!fs.existsSync(overlayBase)) {
    console.error(`overlay base folder not found at: ${ overlayBase }`);
    process.exit(FAILURE);
}

function isDir(p) {
    return fs.statSync(p).isDirectory();
}

function listFlavors(baseFolder: string, overlay: string) {
    return fs.readdirSync(path.join(baseFolder, overlay))
        .filter(p => p.startsWith("_") && isDir(path.join(baseFolder, overlay, p)))
        .map(p => p.replace(/^_/, ""))
        .concat(["default"]);
}

export function generateConfigurations(baseFolder: string): IOverlayConfigurations {
    return fs.readdirSync(baseFolder)
        .filter(p => isDir(path.join(baseFolder, p)) && p !== "disabled")
        .reduce((all, overlay) => {
            all[overlay] = all[overlay] || {};
            const flavors = listFlavors(baseFolder, overlay);
            all[overlay] = {
                ...all[overlay],
                ...OverlayConfiguration.generateFlavors(overlay, flavors)
            };
            return all;
        }, {} as IOverlayConfigurations);
}


export const configurations = generateConfigurations(overlayBase);
