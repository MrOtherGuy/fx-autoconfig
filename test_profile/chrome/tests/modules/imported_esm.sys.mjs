// ==UserScript==
// @name           test_imported_esm
// ==/UserScript==
import{ UCUtils } from "chrome://userchromejs/content/utils.sys.mjs";
const some = {
  test_value: 42,
  loaderVersion: UCUtils.version,
  setToX: function(x){
    this.test_value = x 
  }
};

export { some }