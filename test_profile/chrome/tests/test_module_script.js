// ==UserScript==
// @name           test_module_script
// @backgroundmodule
// ==/UserScript==

let is_success = false;
const x = 23;
try{
  let x = window;
}catch(e){
  console.log(e);
  is_success = true;
}

console.log("test_module_script passed" : is_success);