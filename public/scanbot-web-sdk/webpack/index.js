// Main entry point for webpack-based projects
// require('scanbot-web-sdk/webpack') resolves to this file, which automatically copies the web-worker and webassembly files using file-loader
const path = require('./fileLoader').path;
var ScanbotSDK = module.exports = require("../bundle/ScanbotSDK.min.js").ScanbotSDK;
ScanbotSDK.defaultEnginePath = path.split('/').slice(0, -1).join('/') + '/';
