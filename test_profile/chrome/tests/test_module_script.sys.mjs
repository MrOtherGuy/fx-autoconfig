// ==UserScript==
// @name           test_module_script_ESM
// ==/UserScript==

import { some } from "chrome://userscripts/content/modules/imported_esm.sys.mjs";
import { Test } from "chrome://userscripts/content/000_test_runner.sys.mjs";
import { SharedStorage } from "chrome://userchromejs/content/uc_api.sys.mjs";

new Test("expectError_no_utils_ESM",()=>{
  return SharedStorage.test_utils.x
}).expectError();

new Test("ESM_sharedGlobal_written",()=>{
  SharedStorage.test_module_script_ESM = {y: 42};
  return true
}).expect(true);

new Test("expectError_no_window_ESM",()=>{
  return window
}).expectError();

new Test("ESM_import_some_equals_42",()=>{
  return some.test_value
}).expect(42);

new Test("ESM_import_version_is_string",()=>{
  return (typeof some.loaderVersion)
}).expect("string");

new Test("ESM_import_set_value",()=>{
  some.setToX(123);
  return new Promise(res => {
    const { some } = ChromeUtils.importESModule("chrome://userscripts/content/modules/imported_esm.sys.mjs");
    res(some.test_value)
  })
}).expectAsync(123);
