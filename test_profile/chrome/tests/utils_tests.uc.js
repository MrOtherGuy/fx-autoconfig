// ==UserScript==
// @name           test_utils
// @onlyonce
// @loadOrder 5
// ==/UserScript==

"use strict";
const BRAND_NAME = "Firefox Nightly";
const x_value = 42;


const { Test } = ChromeUtils.import("chrome://userscripts/content/000_test_runner.uc.js");

_ucUtils.sharedGlobal.test_utils = { x: 42 };

const TEST_FILES = [
"000_test_runner.uc.js",
"aaa_test_script.uc.js",
"test_module_script.uc.js",
"utils_tests.uc.js"
];

new Test("sharedGlobal",()=>{
  return _ucUtils.sharedGlobal.test_utils.x
}).expect(42);


new Test("brandName",()=>{
  return _ucUtils.brandName
}).expect(BRAND_NAME);

new Test("createXulElement",()=>{
  let node = _ucUtils.createElement(document,"vbox",{class:"test-vbox","hidden":true});
  return node.className;
}).expect("test-vbox");

new Test("createHTMLElement",()=>{
  let node = _ucUtils.createElement(document,"div",{class:"test-div","hidden":true},true);
  return node.className;
}).expect("test-div");

// TODO createWidget

new Test("readFileFromString",()=>{
  return _ucUtils.readFile("test_file.txt");
}).expect("This is a test file used in testing");

new Test("readFileFromFile",()=>{
  let file = _ucUtils.getFSEntry("test_file.txt");
  return _ucUtils.readFile(file);
}).expect("This is a test file used in testing");

new Test("readFileAsync",()=>{
  return _ucUtils.readFileAsync("test_file.txt")
}).expectAsync("This is a test file used in testing");

new Test("readJSON",()=>{
  return new Promise((res,rej) => {
    _ucUtils.readJSON("test_json.json")
    .then(some => res(some.property))
    .catch((err) => rej(err))
  })
}).expectAsync("This is a test file used in testing");

new Test("writeFileBasic",()=>{
  return new Promise((res,rej) => {
    let bytes = null;
    _ucUtils.writeFile("write_test_basic.txt","test file content")
    .then(some => { bytes = some })
    .then(() => _ucUtils.readFileAsync("write_test_basic.txt"))
    .then((text) => res(text+": "+bytes) )
    .catch((err) => rej(err))
  })
}).expectAsync("test file content: 17");

new Test("listFileNames",()=>{
  let files = _ucUtils.getFSEntry("../tests/");
  let names = [];
  while(files.hasMoreElements()){
    let file = files.getNext().QueryInterface(Ci.nsIFile);
    if(file.isFile()){
      names.push(file.leafName);
    }
  }
  return names.join(",");
}).expect(TEST_FILES.join(","));

// TODO createFileURI

new Test("getChromeDir",()=>{
  let items = _ucUtils.chromeDir.files;
  let names = [];
  while(items.hasMoreElements()){
    let file = items.getNext().QueryInterface(Ci.nsIFile);
    if(file.isDirectory()){
      names.push(file.leafName);
    }
  }
  return names.join(",");
}).expect("resources,tests,utils");

new Test("getFSEntry",()=>{
  return _ucUtils.getFSEntry("test_file.txt") != null;
}).expect(true);

new Test("getScriptData",()=>{
  let scripts = _ucUtils.getScriptData();
  return scripts.map(a => a.name).sort().join(",");
}).expect("test_module_script,test_runner,test_utils,");

new Test("getScriptLoadOrder",()=>{
  let scripts = _ucUtils.getScriptData();
  return scripts.sort((a,b) => a.name < b.name ? -1 : 1).map(a=> a.isRunning).join(",");
}).expect("false,true,true,false");

new Test("getWindows",()=>{
  return _ucUtils.windows.get()[0].AppConstants.MOZ_APP_BASENAME;
}).expect("Firefox");

// TODO togglescript

_ucUtils.prefs.set("userChromeJS.allowUnsafeWrites",false);

new Test("excpectError_writeUserChromeCSS_BeforeStartup",() => {
  return _ucUtils.writeFile("../userChrome.css","#nav-bar{ background: #f00 !important; }")
}).expectError();

new Test("updateStyleSheet",()=>{
  _ucUtils.prefs.set("userChromeJS.allowUnsafeWrites",true);
  
  return new Promise((res,rej) => {
    _ucUtils.windowIsReady(window)
    .then(()=>{
      let color = window.getComputedStyle(document.getElementById("nav-bar")).backgroundColor;
      _ucUtils.writeFile("../userChrome.css","#nav-bar{ background: #ba5 !important; }")
      .then(()=>_ucUtils.updateStyleSheet())
      .then(Test.createTimeout)
      .then(()=>{
        res(color + " : " + window.getComputedStyle(document.getElementById("nav-bar")).backgroundColor)
      })
    })
    .catch(err => rej(err))
  })
}).expectAsync("rgb(255, 0, 0) : rgb(187, 170, 85)");

// Restore old userChrome.css state
// The above test setup sets pref to allow writing outside of resources so this should succeed.
new Test("writeUserChromeCSS",() => {
  return new Promise((res,rej) => {
    Test.createTimeoutLong()
    .then(()=>{
      return _ucUtils.writeFile("../userChrome.css","#nav-bar{ background: #f00 !important; }")
    })
    .then(res)
    .catch(rej)
  })
}).expectAsync(40)
// Set allowUnsafeWrites pref back to false and check that writing to it now fails
.then(() => {
  _ucUtils.prefs.set("userChromeJS.allowUnsafeWrites",false);
  new Test("excpectError_writeUserChromeCSS_AfterStartup",() => {
    return _ucUtils.writeFile("../userChrome.css","#nav-bar{ background: #f00 !important; }")
  }).expectError()
})
.then(Test.logResults);

// TODO updateMenuStatus

new Test("startupFinished",()=>{
  return new Promise((res,rej) => {
    setTimeout(rej,4000);
    _ucUtils.startupFinished()
    .then(()=>res(42))
  })
}).expectAsync(42);

new Test("WindowIsReady",()=>{
  return new Promise((res,rej) => {
    setTimeout(rej,4000);
    _ucUtils.windowIsReady(window)
    .then(()=>res(42))
  })
}).expectAsync(42);

new Test("registerHotkey",()=>{
  
  let details = {
    id: "myHotkey",
    modifiers: "ctrl shift",
    key: "Y"
  };
  let val = _ucUtils.registerHotkey(details,()=>({}));
  if(!val){
    return false
  }
  let key = document.getElementById("myHotkey");
  return key.getAttribute("modifiers")+","+key.getAttribute("key");
}).expect("accel,shift,Y");

// TODO loadURI

// TODO showNotification

// TODO restart

