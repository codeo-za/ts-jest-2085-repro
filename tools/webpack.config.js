const
    DefinePlugin = require("webpack").DefinePlugin,
    CopyPlugin = require("copy-webpack-plugin"),
    overlayConfig = require("./build.service").buildService.selectedOverlayConfig,
    webpackPlugins = [
        new CopyPlugin([ {
            from: overlayConfig.publicPath,
            to: "./",
            ignore: process.env.NODE_ENV === "production" ? [ "test-data/*" ] : []
        }]),
        new DefinePlugin({
            "OVERLAY": `"${overlayConfig.name}"`,
            "FLAVOR": `"${overlayConfig.flavor}"`,
            "ENVIRONMENT": `"${process.env.NODE_ENV || "debug"}"`
        })
    ],
    overlayWebpackExternalPlugins = overlayConfig.webpackExternalPlugins,
    FlavorResolver = require("./flavor-resolver").FlavorResolver,
    ExternalsPlugin = require("html-webpack-externals-plugin");

if (overlayWebpackExternalPlugins && overlayWebpackExternalPlugins.length > 0) {
    overlayWebpackExternalPlugins.forEach((v) => {
        let p = new ExternalsPlugin(v);
        webpackPlugins.push(p);
    });
}

if (!global.jest) {
    console.info("setting alias [overlay] to: ", overlayConfig.base);
}
const copyConfig = [
    { from: overlayConfig.publicPath, to: "./" }
];
if (overlayConfig.flavorPublicPath) {
    copyConfig.push({ from: overlayConfig.flavorPublicPath, to: "./" });
}
module.exports = {
    // see https://webpack.js.org/configuration/devtool/
    devtool: process.env.NODE_ENV === "production" ? "none" : "eval-source-map",
    plugins: webpackPlugins,
    output: {
        devtoolModuleFilenameTemplate: info => {
            let $filename = "sources://" + info.resourcePath;
            if (info.resourcePath.match(/\.vue$/) && !info.query.match(/type=script/)) {
                $filename = "webpack-generated:///" + info.resourcePath + "?" + info.hash;
            }
            return $filename;
        },
        publicPath: "/",
        devtoolFallbackModuleFilenameTemplate: "webpack:///[resource-path]?[hash]",
    },
    resolve: {
        alias: {
            "overlay": overlayConfig.base
        },
        plugins: [
            new FlavorResolver(
                overlayConfig.name,
                overlayConfig.flavor,
                process.env.FLAVOR_RESOLUTION_LOG_LEVEL
            )
        ]
    }
};
