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

const PROMISES = [
  new Test("non_background_mjs_got_cheese",()=>{
    return Cheese.type
  }).expect("emmental"),
  
  new Test("non_background_mjs_got_ucUtils_from_window",()=>{
    return _ucUtils.brandName
  }).expect("Firefox Nightly")
];

Test.waitForTestSet(PROMISES)