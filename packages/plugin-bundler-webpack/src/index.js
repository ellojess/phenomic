// @flow

import path from "path";

import webpack from "webpack";
import webpackDevMiddleware from "webpack-dev-middleware";
import webpackHotMiddleware from "webpack-hot-middleware";
import logger from "@phenomic/core/lib/logger";
import { findCacheDirectory } from "@phenomic/core/lib/Utils.bs.js";

import webpackPromise from "./webpack-promise.js";
import getWebpackConfig from "./WebpackGetConfig.js";
import WebpackServerConfigModifier from "./WebpackServerConfigModifier.js";

const debug = require("debug")("phenomic:plugin:bundler-webpack");

const pluginName = "@phenomic/plugin-bundler-webpack";
const log = logger(pluginName);

const cacheDir = findCacheDirectory("webpack");

const bundlerWebpack: PhenomicPluginModule<{}> = config => {
  return {
    name: pluginName,
    addDevServerMiddlewares() {
      debug("get middlewares");
      const webpackConfig = getWebpackConfig(config);
      // $FlowFixMe interface sucks
      const compiler = webpack(webpackConfig);
      let assets = {};
      // $FlowFixMe interface sucks
      compiler.hooks.done.tap(pluginName + "/dev-server-middleware", stats => {
        assets = {};
        const namedChunks = stats.compilation.namedChunks;
        namedChunks.forEach((chunk, chunkName) => {
          const files = chunk.files.filter(
            file => !file.endsWith(".hot-update.js"),
          );
          if (files.length) {
            assets = {
              ...assets,
              [chunkName]: files.shift(),
            };
          }
        });
      });
      return [
        (
          req: express$Request,
          res: express$Response,
          next: express$NextFunction,
        ) => {
          res.locals.assets = assets;
          next();
        },
        webpackDevMiddleware(compiler, {
          publicPath: config.baseUrl.pathname,
          logLevel: "warn",
          stats: webpackConfig.stats,
          // logger: log, // output info even if logLevel: "warn"
        }),
        webpackHotMiddleware(compiler, { reload: true, log }),
      ];
    },
    buildForPrerendering() {
      debug("build for prerendering");
      return webpackPromise(WebpackServerConfigModifier(config, cacheDir)).then(
        // $FlowFixMe no I can't
        () => require(path.join(cacheDir, config.bundleName)).default,
      );
    },
    build() {
      debug("build");
      return webpackPromise(getWebpackConfig(config)).then(
        stats => stats.toJson().assetsByChunkName,
      );
    },
  };
};

export default bundlerWebpack;
