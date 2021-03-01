require("ts-node").register();

const
    { buildService } = require("./tools/build.service"),
    configureWebpack = require("./tools/webpack.config"),
    overlayConfig = buildService.selectedOverlayConfig;

const
    listen = process.env.LISTEN || "localhost:8888",
    parts = listen.split(":"),
    host = parts[0],
    portString = parts[1] || "8888",
    parsed = parseInt(portString),
    port = isNaN(parsed) || parsed < 80
        ? 8888
        : parsed;

function generateExclusionsForOtherOverlays(
    thisOverlay,
    allOverlays) {
    const toExclude = new Set(allOverlays);
    toExclude.delete(thisOverlay);
    return Array.from(toExclude).map(overlayName => {
        const re = `overlays[/|\\\\]${overlayName}[/|\\\\]`;
        return new RegExp(re);
    });
}

module.exports = {
    outputDir: overlayConfig.distributionDirectory,
    pages: {
        app: {
            entry: "src/main.ts",
            template: "static/index.html",
            filename: "index.html",
            title: overlayConfig.title,
            metaDescription: overlayConfig.metaDescription,
        },
    },
    css: {
        loaderOptions: {
            sass: {
                data: `@import "@/scss/config.scss";`,
            }
        },
    },
    devServer: {
        disableHostCheck: true,
        host,
        compress: true,
        https: true,
        port,
        proxy: {
            "/rtapi": {
                target: "https://api.le_default.com",
                ws: true,
                changeOrigin: true,
            },
        },
    },
    productionSourceMap: false,
    configureWebpack,
    chainWebpack: config => {
        debugger;
        config.module
            .rule("images")
            .use("url-loader")
            .loader("url-loader")
            .tap(options => Object.assign({}, options, { limit: 512 }));
        config.module
            .rule("ts")
            .use("ts-loader")
            .loader("ts-loader")
            .tap(options => {
                return Object.assign(
                    {},
                    options,
                    {
                        appendTsSuffixTo: [],
                        experimentalWatchApi: true,
                        experimentalFileCaching: true
                    });
            });
        const exclude = config.module.rule("vue").exclude;
        const regexes = generateExclusionsForOtherOverlays(
            overlayConfig.name,
            buildService.listAllOverlays()
        )
        regexes.forEach(re => exclude.add(re));
    },
    pwa: overlayConfig.pwaConfig
};
