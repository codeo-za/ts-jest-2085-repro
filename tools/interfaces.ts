export interface IOverlayConfiguration {
    name: string;
    flavor: string;
    base: string;
    distributionDirectory: string;
    scssPath: string;
    publicPath: string;
    flavorPublicPath: string;
    configPath: string;
    projectBase: string;
    webpackExternalPlugins: any[];

    title: string;
    metaDescription: string;
    pwaPromptEnabled: boolean;
    pwaConfig: IPWAPluginConfig;
}

export interface IOverlayConfigurations {
    [overlay: string]: IFlavoredOverlayConfiguration;
}

export interface IFlavoredOverlayConfiguration {
    [flavor: string]: IOverlayConfiguration;
}

export interface Dictionary<T> {
    [key: string]: T;
}

export interface ManifestIcon {
    src: string;
    type: string;
    sizes: string;
}

export interface Manifest {
    short_name: string;
    name: string;
    icons: ManifestIcon[];
    start_url: string;
    background_color: string;
    display: "fullscreen" | "standalone" | "minimal-ui" | "browser";
    orientation: "landscape" | "portrait";
    scope?: string;
    theme_color: string;
}

export interface ManifestTransformResult {
    manifest: Manifest;
    warnings: string[];
}

export type ManifestTransform = (manifest: Manifest) => ManifestTransformResult;

// https://developers.google.com/web/tools/workbox/modules/workbox-webpack-plugin#full_generatesw_config
export interface IWorkboxOptions {
    // relate to webpack
    swDest?: string;  // default: "service-worker.js"
    importWorkboxFrom?: "cdn" | "local" | "disabled"; // default "cdn",
    chunks?: string[]; // default: []
    excludeChunks?: string[]; // default []
    include?: Array<RegExp | string>; // determine which assets to include
    exclude?: Array<RegExp | string>; // default: [/\.map$/, /^manifest.*\.js(?:on)?$/]
    importsDirectory?: string; // default: ""
    precacheManifestFilename?: string; // default "precache-manifest.[hash].js

    // relate to manifest generation via workbox
    skipWaiting?: boolean; // default false
    clientsClaim?: boolean; // default false
    runtimeCaching?: object[]; // default []
    navigateFallback?: string; // default undefined
    navigateFallbackBlacklist?: RegExp[]; // default []
    navigateFallbackWhitelist?: RegExp[]; // default []
    importScripts?: string[]; // docs say required, but this seems to be managed by vue?
    ignoreURLParametersMatching?: RegExp[]; // default [/^utm_/]
    directoryIndex?: string; // default "index.html"
    cacheId?: string; // default null
    offlineGoogleAnalytics?: boolean; // default false
    cleanupOutdatedCaches?: boolean; // default false (TODO: probably should turn this on)
    globDirectory?: string; // default undefined
    globFollow?: boolean; // default true
    globIgnores?: string[]; // default ["node_modules/**/*"]
    globPatterns?: string[]; // default [] for webpack
    globStrict?: boolean; // default true
    templatedURLs?: Dictionary<string | string[]>; // default null
    maximumFileSizeToCacheInBytes?: number; // default 2097152
    dontCacheBustURLsMatching?: RegExp; // null
    modifyURLPrefix?: Dictionary<string>; // null
    manifestTransforms?: ManifestTransform[]; // null
}

export interface IPWAIconPaths {
    favicon32?: string; // "img/icons/favicon-32x32.png"
    favicon16?: string; // "img/icons/favicon-16x16.png"
    appleTouchIcon?: string; // "img/icons/apple-touch-icon-152x152.png"
    maskIcon?: string; // "img/icons/safari-pinned-tab.svg
    msTileImage?: string; // "img/icons/msapplication-icon-144x144.png
}

export interface IPWAPluginConfig {
    name?: string; // defaults to name in package.json
    themeColor?: string; // #4DBA87
    backgroundColor?: string; // shown on splash screen
    msTileColor?: string; // #000000
    // https://medium.com/@firt/dont-use-ios-web-app-meta-tag-irresponsibly-in-your-progressive-web-apps-85d70f4438cb
    appleMobileWebAppCapable?: "yes" | "no"; // no
    assetsVersion?: string; // ""
    manifestPath?: string; // "manifest.json"
    iconPaths?: IPWAIconPaths; //

    workboxPluginMode?: "GenerateSW" | "InjectManifest"; // default is "GenerateSW"
    workboxOptions?: IWorkboxOptions;
}

export interface IOverlayJsonConfig {
    title: string;
    metaDescription: string;
    pwaPromptEnabled: boolean;
    pwa: IPWAPluginConfig;
    webpackExternalPlugins: any[];
}
