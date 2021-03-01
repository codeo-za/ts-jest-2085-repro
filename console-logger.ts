export enum LogLevels {
    debug,
    log,
    info,
    warn,
    error,
    none
}

export class ConsoleLogger {
    public readonly debug: (...args) => void;
    public readonly log: (...args) => void;
    public readonly info: (...args) => void;
    public readonly warn: (...args) => void;
    public readonly error: (...args) => void;
    private readonly _prefix: string;

    constructor(
        prefix: string,
        logLevel: LogLevels | string) {
        this._prefix = prefix;
        logLevel = logLevel === undefined
            ? LogLevels.info
            : logLevel;
        if (typeof logLevel === "string") {
            logLevel = LogLevels[logLevel];
            if (logLevel === undefined) {
                logLevel = LogLevels.info;
            }
        }
        const
            debug = logLevel <= LogLevels.debug,
            log = logLevel <= LogLevels.log,
            info = logLevel <= LogLevels.info,
            warn = logLevel <= LogLevels.warn,
            error = logLevel <= LogLevels.error;
        this.debug = this._bindLog(debug, "debug");
        this.log = this._bindLog(log, "log");
        this.info = this._bindLog(info, "info");
        this.warn = this._bindLog(warn, "warn");
        this.error = this._bindLog(error, "error");
    }

    private _bindLog(flag: boolean, name: keyof typeof console) {
        return flag
            ? this._log.bind(this, name)
            : this._noop;
    }

    private _noop() {
        /* does nothing */
    }

    private _log(type: keyof typeof console, ...args) {
        if (typeof args[0] === "string") {
            args[0] = `${this._prefix}: [${ type }] ${ args[0] }`;
        } else {
            args.unshift(`${this._prefix}: [${ type }]`);
        }
        console[type](...args);
    }

}

