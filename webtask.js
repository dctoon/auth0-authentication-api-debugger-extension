var Webtask = require('webtask-tools');

// This is the entry-point for the Webpack build. We need to convert our module
// (which is a simple Express server) into a Webtask-compatible function.
module.exports = Webtask.fromExpress(require('./index.js'));

const tools = require('auth0-extension-express-tools');

const app = require('./index.js');

module.exports = tools.createServer(function(config, storage) {
  return app(config, storage);
});