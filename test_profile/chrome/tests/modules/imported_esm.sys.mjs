// ==UserScript==
// @name           test_imported_esm
// ==/UserScript==
import{ Runtime } from "chrome://userchromejs/content/uc_api.sys.mjs";
const some = {
  test_value: 42,
  loaderVersion: Runtime.loaderVersion,
  setToX: function(x){
    this.test_value = x 
  }
};

export { some }