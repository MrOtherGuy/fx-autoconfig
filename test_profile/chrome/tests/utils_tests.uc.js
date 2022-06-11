// ==UserScript==
// @name           test_utils
// @onlyonce
// @loadOrder 5
// ==/UserScript==

const BRAND_NAME = "Firefox Nightly";
const x_value = 42;
_ucUtils.sharedGlobal.test_utils = { x: 42 };

class Test{
  constructor(name,fun){
    this.name = name;
    this.fun = fun;
  }
  exec(){
    return this.fun()
  }
  expectAsync(expect){
    Test.runnerAsync(this, expect)
  }
  expect(expect){
    Test.runner(this, expect)
  }
  static runner(test,expect){
    try{
      let value = test.exec();
      if(value === expect){
        console.log(test.name+": OK")
      }else{
        console.warn(`${test.name} failed: expected: ${expect} - got: ${value}`);
      }
    }catch(e){
      console.error(e);
    }
  }
  static async runnerAsync(test,expect){
    try{
      let value = await test.exec();
      if(value === expect){
        console.log(test.name+": OK")
      }else{
        console.warn(`${test.name} failed: expected: ${expect} - got: ${value}`);
      }
    }catch(e){
      console.error(e);
    }
  }
}

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
    .then((text)=> res(text+": "+bytes) )
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
}).expect("aaa_test_script.uc.js,test_module_script.uc.js,utils_tests.uc.js");

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
}).expect("test_module_script,test_utils,");

new Test("getScriptLoadOrder",()=>{
  let scripts = _ucUtils.getScriptData();
  return scripts.sort((a,b) => a.name < b.name ? -1 : 1).map(a=> a.isRunning).join(",");
}).expect("false,true,false");

new Test("getWindows",()=>{
  return _ucUtils.windows.get()[0].AppConstants.MOZ_APP_BASENAME;
}).expect("Firefox");

// TODO togglescript

// TODO updateStyleSheet

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

