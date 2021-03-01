import * as path from "path";
import * as fs from "fs";
import {
    IFlavoredOverlayConfiguration,
    IOverlayConfiguration,
    IOverlayJsonConfig,
    IPWAPluginConfig
} from "./interfaces";

export const projectBase = path.resolve(path.join(__dirname, "..")).replace(/\\/g, "/");
export const overlayBase = path.join(projectBase, "src", "overlays").replace(/\\/g, "/");

const defaultPWAPluginConfig: IPWAPluginConfig = {
    name: "",
    themeColor: "#FFFFFF",
    workboxPluginMode: "GenerateSW",
    iconPaths: {
        favicon16: "img/icons/favicon-16x16.png",
        favicon32: "img/icons/favicon-32x32.png",
    },
    workboxOptions: {
        exclude: [
            /index.html$/,
            /service-worker.js$/,
            /\.map$/,
            /img\/icons\//,
            /favicon\.ico$/,
            /manifest\.json$/,
        ],
    },
};

export class OverlayConfiguration implements IOverlayConfiguration {

    public name: string;
    public base: string;
    public distributionDirectory: string;
    public publicPath: string;
    public flavorPublicPath: string;
    public scssPath: string;
    public configPath: string;
    public projectBase: string;
    public pwaPromptEnabled: boolean;
    public flavor: string;

    public get title() {
        return this.config.title;
    }

    public get metaDescription() {
        return this.config.metaDescription;
    }

    public get pwaConfig() {
        return {
            ...defaultPWAPluginConfig,
            ...{
                name: this.config.title,
            } as IPWAPluginConfig,
            ...this.config.pwa
        } as IPWAPluginConfig;
    }

    private get config(): IOverlayJsonConfig {
        if (this._config) {
            return this._config;
        }
        return this._config = this._readConfig();
    }

    public get webpackExternalPlugins(): any[] {
        const config = this._readConfig();
        return config.webpackExternalPlugins;
    }

    private _config: IOverlayJsonConfig;

    constructor(overlay: string, flavor: string) {
        this.name = overlay;
        this.flavor = flavor;
        this.projectBase = projectBase;
        this.base = path.join(overlayBase, overlay);
        this.distributionDirectory = flavor === "default"
            ? path.join(projectBase, "dist", overlay)
            : path.join(projectBase, "dist", `${overlay}_${flavor}`);
        this.scssPath = path.join(this.base, "scss");
        this.publicPath = path.join(this.base, "public");
        if (flavor) {
            this.flavorPublicPath = path.join(this.base, `_${flavor}`, "public");
        }
        this.configPath = path.join(this.base, "config.json");
    }

    private _readConfig(): IOverlayJsonConfig {
        const json = fs.readFileSync(this.configPath, { encoding: "utf-8" });
        return JSON.parse(json) as IOverlayJsonConfig;
    }

    public static generateFlavors(overlay: string, flavors: string[]): IFlavoredOverlayConfiguration {
        return flavors.reduce(
            (acc, cur) => {
                acc[cur] = new OverlayConfiguration(overlay, cur);
                return acc;
            }, {} as IFlavoredOverlayConfiguration
        );
    }
}

