require('!!file-loader?name=ScanbotSDK.Core.js!../bundle/bin/complete/ScanbotSDK.Core.js');
require('!!file-loader?name=ScanbotSDK.Core-simd.js!../bundle/bin/complete/ScanbotSDK.Core-simd.js');
require('!!file-loader?name=ScanbotSDK.Core-simd-threads.js!../bundle/bin/complete/ScanbotSDK.Core-simd-threads.js');

export const path = require('!!file-loader?esModule=false&name=ScanbotSDK.Asm.wasm!../bundle/bin/complete/ScanbotSDK.Asm.wasm');
require('!!file-loader?esModule=false&name=ScanbotSDK.Asm-simd.wasm!../bundle/bin/complete/ScanbotSDK.Asm-simd.wasm');
require('!!file-loader?esModule=false&name=ScanbotSDK.Asm-simd-threads.wasm!../bundle/bin/complete/ScanbotSDK.Asm-simd-threads.wasm');
require('!!file-loader?esModule=false&name=ScanbotSDK.Asm-simd-threads.js!../bundle/bin/complete/ScanbotSDK.Asm-simd-threads.js');