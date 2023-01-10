// ==UserScript==
// @name write-42
// @description    write 42 to shared global which utils_tests.uc.js should later check
// @loadOrder 1
// @onlyonce
// ==/UserScript==
_ucUtils.sharedGlobal.test_utils = { x: 42 }