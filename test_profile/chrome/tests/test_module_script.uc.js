// ==UserScript==
// @name           test_module_script
// @backgroundmodule
// ==/UserScript==
let EXPORTED_SYMBOLS = [];
let is_success = false;
const x = 23;
try{
  let x = window;
}catch(e){
  is_success = true;
}
if(is_success){
  console.log("test_module_script: OK");
}else{
  console.warn("test_module_script: expected failure got: success")
}
