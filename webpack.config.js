const path = require("path");
const fs = require("fs");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const site = require("./src/site.json");

const PUBLIC_DIRS = ["brand", "icons"];
const PUBLIC_FILES = [
  "manifest.webmanifest",
  "llms.txt",
  "robots.txt",
  "favicon.ico",
  "og-image.jpg",
];
const sitemap = () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${site.url}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
  </url>
</urlset>
`;

module.exports = (env, argv) => {
  const production = argv.mode === "production";
  return {
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].[contenthash:8].js",
    chunkFilename: "[name].[contenthash:8].js",
    clean: true,
    publicPath: "/",
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"],
          },
        },
      },
      {
        test: /\.css$/,
        use: [
          production ? MiniCssExtractPlugin.loader : "style-loader",
          { loader: "css-loader", options: { url: false } },
        ],
      },
      {
        test: /\.(png|svg|ttf|webmanifest)$/,
        type: "asset/resource",
      },
    ],
  },
  resolve: {
    extensions: [".js", ".jsx"],
  },
  optimization: {
    minimizer: ["...", new CssMinimizerPlugin()],
  },
  plugins: [
    ...(production
      ? [new MiniCssExtractPlugin({ filename: "[name].[contenthash:8].css" })]
      : []),
    new HtmlWebpackPlugin({
      template: "./public/index.html",
      site,
    }),
    {
      apply(compiler) {
        compiler.hooks.thisCompilation.tap("PublicAssets", (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: "PublicAssets",
              stage:
                compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
            },
            () => {
              const { RawSource } = compiler.webpack.sources;
              const emit = (name, data) =>
                compilation.emitAsset(name, new RawSource(data));
              const read = (name) =>
                fs.readFileSync(path.join(__dirname, "public", name));
              for (const dir of PUBLIC_DIRS)
                for (const file of fs.readdirSync(path.join(__dirname, "public", dir)))
                  emit(`${dir}/${file}`, read(`${dir}/${file}`));
              for (const file of PUBLIC_FILES) emit(file, read(file));
              emit("sitemap.xml", sitemap());
            },
          );
        });
      },
    },
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, "public"),
    },
    compress: true,
    port: 3000,
    hot: true,
    historyApiFallback: true,
  },
  };
};
