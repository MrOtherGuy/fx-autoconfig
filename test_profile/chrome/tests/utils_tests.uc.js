// ==UserScript==
// @name           test_utils
// @onlyonce
// @loadOrder 5
// ==/UserScript==

"use strict";
const BRAND_NAME = "Firefox Nightly";
const SHARED_GLOBAL_TEST_X = 42;

const { Test } = ChromeUtils.importESModule("chrome://userscripts/content/000_test_runner.sys.mjs");

_ucUtils.sharedGlobal.test_utils = { x: SHARED_GLOBAL_TEST_X };

// Needs to be alphabetical
const TEST_FILES = [
"000_test_runner.sys.mjs",
"aaa_test_script.uc.js",
"test_module_script.sys.mjs",
"test_module_script.uc.js",
"utils_tests.uc.js"
];
console.info("%crunning tests...","color: rgb(120,160,240)");


new Test("sharedGlobal",()=>{
  return _ucUtils.sharedGlobal.test_utils.x
}).expect(SHARED_GLOBAL_TEST_X);


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

// Note: aaa_test_script.uc.js does not have a name so it gets sorted to last
new Test("getScriptData",()=>{
  let scripts = _ucUtils.getScriptData();
  return scripts.length + ";" + scripts.map(a => a.name).sort().join(",");
}).expect(TEST_FILES.length+";test_module_script,test_module_script_ESM,test_runner,test_utils,");

// This test assumes that none of the test scripts have been manually disabled
new Test("getScriptLoadOrder",()=>{
  let scripts = _ucUtils.getScriptData();
  return scripts.sort((a,b) => a.name < b.name ? -1 : 1).map(a=> a.isRunning).join(",");
}).expect("false,true,true,true,false");

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

new Test("CancelRestart",()=>{
  
  return new Promise((res,rej) => {
    let reason = null;
    let restartCancelObserver = (subject, topic, data) => {
      subject.data = true;
      reason = data;
      Services.obs.removeObserver(restartCancelObserver, "quit-application-requested");
    };
    Services.obs.addObserver(restartCancelObserver, "quit-application-requested");
    
    Test.createTimeout()
    .then(_ucUtils.restart)
    .then(some => { return res( `${reason} ${some ? "succeeded" : "canceled"}` ) })
    .catch(rej)
  })
  
  
}).expectAsync("restart canceled");
