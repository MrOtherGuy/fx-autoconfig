// ==UserScript==
// @name           test_imported_esm
// ==/UserScript==
import{ _ucUtils } from "chrome://userchromejs/content/utils.sys.mjs";
const some = {
  test_value: 42,
  loaderVersion: _ucUtils.version,
  setToX: function(x){
    this.test_value = x 
  }
};

export { some }