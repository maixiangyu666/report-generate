const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

/** @type {import('webpack').Configuration} */
const extensionConfig = {
  target: 'node',
  mode: 'none',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/images',
          to: 'images'
        }
      ]
    })
  ],
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: false,
              happyPackMode: false,
              configFile: path.resolve(__dirname, 'tsconfig.json')
            }
          }
        ]
      }
    ]
  },
  devtool: 'source-map',
  watch: true,
  infrastructureLogging: {
    level: "log",
  },
  stats: {
    warningsFilter: /export .* was not found in/
  }
};

module.exports = [ extensionConfig ];
