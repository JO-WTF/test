const path = require('./fileLoader').path;
var ScanbotSDK = module.exports = require("../bundle/ScanbotSDK.ui2.min.js").ScanbotSDK;
ScanbotSDK.defaultEnginePath = path.split('/').slice(0, -1).join('/') + '/';