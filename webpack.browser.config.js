const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/browser/script-loader.ts',
  output: {
    filename: 'ollang-browser.min.js',
    path: path.resolve(__dirname, 'dist/browser'),
    library: 'Ollang',
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  optimization: {
    minimize: true,
  },
};
