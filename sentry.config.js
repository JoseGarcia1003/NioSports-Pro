const SentryWebpackPlugin = require("@sentry/webpack-plugin");

module.exports = {
  plugins: [
    new SentryWebpackPlugin({
      org: "tu-org",
      project: "niosports-pro",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      
      include: "./dist",
      ignore: ["node_modules", "webpack.config.js"],
    }),
  ],
};
