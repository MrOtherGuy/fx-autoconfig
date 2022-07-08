// ==UserScript==
// @name           test_module_script
// @backgroundmodule
// ==/UserScript==
let EXPORTED_SYMBOLS = [];
const { Test } = ChromeUtils.importESModule("chrome://userscripts/content/000_test_runner.sys.mjs");

new Test("expectError_no_utils",()=>{
  return _ucUtils.sharedGlobal.test_utils.x
}).expectError();

new Test("expectError_no_window",()=>{
  return window
}).expectError();
