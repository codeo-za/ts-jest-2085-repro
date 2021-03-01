import Vue, { VueConstructor } from "vue";

export type RequireFunction = (id: string) => any;

export function registerComponents(
    selectedOverlay: string,
    paths: string[],
    seenComponents: string[],
    requireFn: RequireFunction,
    vue?: VueConstructor<Vue>,
    onlyLoadPaths?: string[],
    debug?: boolean): void {

    const log = debug ? (...args) => {
        args.unshift("[ auto-register ]");
        console.log.call(console, ...args);
    } : () => { /* does nothing, on purpose */
    };
    vue = vue || Vue;

    paths
        .filter(filePath => isFileRequiredToBuildOverlay(filePath, selectedOverlay, log))
        .sort((a, b) => prioritiseOverlayPaths(a, b))
        .forEach(filePath =>
            attemptComponentRegistration(
                onlyLoadPaths,
                filePath,
                log,
                requireFn,
                seenComponents,
                vue)
        );
}

function isFileRequiredToBuildOverlay(
    filePath: string,
    selectedOverlay: string,
    log: (...args) => void) {
    const
        parts = filePath.split("/"),
        overlaysIndex = parts.indexOf("overlays");
    if (overlaysIndex > -1) {
        // test if this is part of the selected overlay or not
        const overlayName = parts[overlaysIndex + 1];
        if (overlayName !== selectedOverlay) {
            log(`skipping de-selected overlay asset: ${ filePath }`);
            return false;
        }
        const potentialFlavor = parts[overlaysIndex + 2] || "";
        if (potentialFlavor.startsWith("_")) {
            log(`skipping flavor file which will be resolved by other magick: ${ filePath }`);
            return false;
        }
    }
    return true;
}

function prioritiseOverlayPaths(
    a: string,
    b: string) {
    if (a === b) {
        return 0;
    }
    const
        aParts = a.split("/"),
        aOverlayIndex = aParts.indexOf("overlays"),
        aIsOverlay = aOverlayIndex > -1,
        bParts = b.split("/"),
        bOverlayIndex = bParts.indexOf("overlays"),
        bIsOverlay = bOverlayIndex > -1;
    if (aIsOverlay && !bIsOverlay) {
        return -1;
    }
    if (bIsOverlay && !aIsOverlay) {
        return 1;
    }
    return a < b ? -1 : 1;
}

function attemptComponentRegistration(
    restrictedPaths: string[],
    filePath,
    log: (...args) => void,
    requireFn: RequireFunction,
    seenComponents: string[],
    vue: VueConstructor<Vue>) {
    if (restrictedPaths) {
        const load = restrictedPaths.reduce(
            (acc, cur) => acc || filePath.replace(/\\\\/g, "/")
                .replace(/\.vue$/, "")
                .endsWith(cur.replace(/\.vue$/, "")),
            false);
        if (!load) {
            log(`skipping ${ filePath }`);
            return;
        }
    }

    let mod = null;
    try {
        log(`load: ${ filePath }`);
        mod = requireFn(filePath);
    } catch (e) {
        console.error(`Can't load module ${ filePath }:`, e);
        return;
    }
    if (!mod) {
        console.warn(`module does not export anything: ${ filePath }`);
        return;
    }
    Object.keys(mod).forEach(modk => {
        const exported = mod[modk],
            options = exported.extendOptions || {},
            name = (options ? options.name : "") || exported.name;
        if (name) {
            if (seenComponents.indexOf(name) > -1) {
                log(` -------  skipping already-seen component: '${ name }' from ${ filePath }`);
                return;
            }
            try {
                vue.component(name, exported);
                log(` +component: ${ name }`);
            } catch (e) {
                console.error(`Unable to auto-register ${ name } from ${ modk }`, e);
            }
            seenComponents.push(name);
        } else {
            console.error(`Could not find name on component ${ filePath }`, mod);
        }
    });
}
