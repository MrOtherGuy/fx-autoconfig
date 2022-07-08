// ==UserScript==
// @name           test_imported_esm
// ==/UserScript==

const some = {
  test_value: 42,
  
  setToX: function(x){
    this.test_value = x 
  }
};

export { some }