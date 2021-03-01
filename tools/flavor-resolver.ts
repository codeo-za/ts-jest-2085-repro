import { existsSync, statSync } from "fs";
import { ConsoleLogger, LogLevels } from "../console-logger";
import * as path from "path";
type Action = () => void;

export class FlavorResolver {
    private readonly _overlay: string;
    private readonly _flavor: string;
    private readonly _logger: ConsoleLogger;
    private readonly _debug: (...args) => void;
    private readonly _info: (...args) => void;
    private readonly _overlayRegex: RegExp;
    private readonly _flavorRegex: RegExp;
    private readonly _remap: string;

    constructor(
        overlay: string,
        flavor: string,
        logLevel?: LogLevels | string
    ) {
        this._validate(overlay, flavor);
        this._overlay = overlay;
        this._flavor = flavor;
        this._logger = new ConsoleLogger("FlavorResolver", logLevel);
        this._debug = this._logger.debug.bind(this._logger);
        this._info = this._logger.info.bind(this._logger);

        const
            sep = path.sep,
            sepMatch = "[\\\\\\/]";
        this._overlayRegex = new RegExp(`${ sepMatch }${ this._overlay }${ sepMatch }`);
        this._flavorRegex = new RegExp(`${ sepMatch }${ this._overlay }${ sepMatch }.*${ this._flavor }${ sepMatch }`);
        this._remap = `${ sep }${ this._overlay }${ sep }_${ this._flavor }${ sep }`;

        this._debug(`Registered Flavor Resolver for ${ overlay } / ${ flavor }`);
    }

    public apply(resolver) {
        const
            requestIsFromOverlay = this._requestIsFromOverlay.bind(this),
            requestedFromFlavor = this._requestedFromFlavor.bind(this),
            findRegionalPathFor = this._findRegionalPathFor.bind(this),
            makeRelativePath = this._makeRelativePath.bind(this);
        resolver.getHook("resolve").tapAsync("FlavorResolver",
            (request, context, callback) => {
                this._doThenCallback(() => {
                    const requestPath = resolver.join(request.path, request.request);
                    if (!requestIsFromOverlay(requestPath)) {
                        return;
                    }
                    this._debug(`Begin request for: ${ requestPath }`);

                    if (requestedFromFlavor(request)) {
                        return;
                    }

                    const regionalPath = findRegionalPathFor(requestPath, request, context);
                    if (fileExists(regionalPath)) {
                        request.request = makeRelativePath(request, regionalPath);
                        this._info(
                            `redirect ${
                                requestPath
                                } to ${
                                resolver.join(request.path, request.request)
                                }`);
                        return;
                    }
                    this._debug(`not redirecting "${ requestPath }" to absent "${ regionalPath }"`);
                }, callback);
            });
    }

    private _findRegionalPathFor(
        requestPath: string,
        request,
        context
    ): string {
        const
            basicRegionalPath = requestPath.replace(this._overlayRegex, this._remap),
            regionalPath = this._resolveImportWorkaroundsFor(basicRegionalPath);
        this._debug({
            request,
            context,
            requestPath,
            regionalPath
        });
        return regionalPath;
    }

    private _requestIsFromOverlay(requestPath: string) {
        return requestPath.match(this._overlayRegex);
    }

    private _requestedFromFlavor(request) {
        const
            issuer = request.context.issuer || "",
            result = !!issuer.match(this._flavorRegex) ||  // ts: file importing this one
                !!request.path.match(this._flavorRegex); // scss: file @including this one
        if (result) {
            this._debug(`request within flavor`, {
                issuer, request
            });
        }
        return result;
    }

    private _doThenCallback(action: Action, callback: Action) {
        action();
        callback();
    }

    private _resolveImportWorkaroundsFor(regionalPath: string) {
        if (regionalPath.match(/\.scss$/)) {
            // scss expects all imports to come from files with leading _
            if (!fileExists(regionalPath)) {
                const
                    dirName = path.dirname(regionalPath),
                    fileName = path.basename(regionalPath),
                    newFilename = fileName.indexOf("_") === 0
                        ? fileName.substr(1)
                        : `_${ fileName }`,
                    newRegionalPath = path.join(dirName, newFilename);
                if (fileExists(newRegionalPath)) {
                    this._info(`scss imports should come from files starting with _`);
                    this._info(`modifying request from ${ regionalPath } to ${ newRegionalPath }`);
                    regionalPath = newRegionalPath;
                }
            }
        } else if (!path.extname(regionalPath)) {
            // ts & js imports can be missing extensions
            if (!fileExists(regionalPath)) {
                if (fileExists(`${ regionalPath }.ts`)) {
                    regionalPath += ".ts";
                } else if (fileExists(`${ regionalPath }.js`)) {
                    regionalPath += ".js";
                }
            }
        }
        return regionalPath;
    }

    private _makeRelativePath(
        request,
        regionalPath) {
        if (path.isAbsolute(request.request) &&
            path.isAbsolute(regionalPath)) {
            // maintain original absoluteness
            return regionalPath;
        }
        const relative = path.relative(request.path, regionalPath);
        return `./${ relative }`;
    }

    private _validate(overlay: string, flavor: string) {
        if ((overlay || "").trim() === "") {
            throw new Error("No overlay provided");
        }
        if ((flavor || "").trim() === "") {
            throw new Error("No flavor provided");
        }
    }
}

const fileExistsCache = {};

function fileExists(withPath: string) {
    const cached = fileExistsCache[withPath];
    if (cached !== undefined) {
        return cached;
    }
    if (!existsSync(withPath)) {
        return fileExistsCache[withPath] = false;
    }
    return fileExistsCache[withPath] = statSync(withPath).isFile();
}

