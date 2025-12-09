// ==UserScript==
// @name           test_non_background_mjs
// @loadOrder   2
// @description
/*
  This test is injected into a window global scope as module script because it has a .uc.mjs extension. We test if normal module mechanisms work such as import statement and that we still have access to _ucUtils from the window global.
  
  This cannot use the same test-set as main utils_tests because module-scripts are injected asynchronously and thus the test-set from utils has already started executing.
*/
// @long-description
// @onlyonce
// ==/UserScript==
import { Cheese } from "chrome://userscripts/content/modules/imported_print.mjs";
import { Test } from "chrome://userscripts/content/000_test_runner.sys.mjs";
import * as UC_API from "chrome://userchromejs/content/uc_api.sys.mjs";

const PROMISES = [
  new Test("non_background_mjs_got_cheese",()=>{
    return Cheese.type
  }).expect("emmental"),
  
  new Test("non_background_mjs_got_ucUtils_from_window",()=>{
    return UC_API.Runtime.brandName
  }).expect("Firefox Nightly"),
  
  new Test("non_background_mjs_fallback_brandName",()=>{
    return UC_API.Runtime.brandName
  }).expect("Firefox Nightly"),
  
  new Test("non_background_mjs_fallback_windows_length",()=>{
    return UC_API.Windows.getAll(false).length > 0
  }).expect(true)
];

Test.waitForTestSet(PROMISES)