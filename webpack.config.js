//const webpack = require('webpack');
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

console.log('build start', new Date().toLocaleString('ja-JP'));

const mainConfig = (env, argv) => {
  return {
    stats: 'minimal',
    target: 'electron-main',
    entry: {
      bundle: './index.js', // Your program entry point
    },
    output: {
      path: path.resolve(__dirname, 'main'),
      filename: 'index.js',
    },
    devtool: false,
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            ecma: 2023,
            compress: { drop_console: true, dead_code: false },
            output: { comments: false, beautify: false, ascii_only: false },
          },
        }),
      ],
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
        },
      ],
    },
    resolve: {
      extensions: ['.js'],
    },
  };
};

const preloadConfig = (env, argv) => {
  return {
    stats: 'minimal',
    target: 'electron-preload',
    entry: './preload.js',
    output: {
      path: path.join(__dirname, 'main'),
      filename: 'preload.js',
    },
    mode: 'production',
    devtool: false,
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            ecma: 2023,
            compress: { drop_console: true },
            output: { comments: false, beautify: false, ascii_only: false },
          },
        }),
      ],
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
        },
      ],
    },
    resolve: {
      extensions: ['.js'],
    },
  };
};

module.exports = (env, argv) => {
  const configs = [];
  if (env.buildMain) {
    configs.push(mainConfig(env, argv));
    configs.push(preloadConfig(env, argv));
    console.log('メインプロセスをビルド対象にします');
  }
  if (configs.length >= 2) {
    console.log('フルビルドします');
  }

  return configs;
};
