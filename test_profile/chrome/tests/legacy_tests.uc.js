// ==UserScript==
// @name           test_utils_legacy
// @onlyonce
// @long-description
// @description    fallback for loaders without multi-line parsing
/*
This file is used to run various tests where main purpose
is to test APIs provided by _ucUtils.
Above line is left empty on purpose to test multi-line descriptions.
 
Above line is also left empty
*/
// @loadOrder 5
// ==/UserScript==

"use strict";

(function(){
  
  const BRAND_NAME = "Firefox Nightly";
  const PREF_ALLLOW_UNSAFE = "userChromeJS.allowUnsafeWrites";
  
  const { Test } = ChromeUtils.importESModule("chrome://userscripts/content/000_test_runner.sys.mjs");
  
  
  const PREF_LISTENER = new (function(){
    let clients = new Set();
    let listener = _ucUtils.prefs.addListener("userChromeJS",(value, prefName) => {
      for(let client of clients){
        client(value,prefName);
      }
      clients.clear()
    });
    this.listenOnce = (fun) => {
      clients.add(fun);
    }
    this.forgetAboutIt = () => {
      _ucUtils.prefs.removeListener(listener);
      listener = null;
    }
    this.size = () => clients.size;
    this.reset = () => {
      listener && this.forgetAboutIt();
      clients.clear();
    }
  })();

  // Needs to be alphabetical
  // This should only include files that are actually runnable tests
  // so no empty files or files with invalid name
  const TEST_FILES = [
  "000_test_runner.sys.mjs",
  "aaa_test_script.uc.js",
  "test_module_script.sys.mjs",
  "test_module_script.uc.js",
  "test_registering_manifest",
  "utils_tests.uc.js",
  "write_to_shared.uc.js"
  ];
  console.info("%crunning tests...","color: rgb(120,160,240)");
  
  const PROMISES = [
  // Synchronously read file content with string argument treated as relative path
  new Test(
    "readFileFromString",
    () => { return _ucUtils.readFile("test_file.txt") }
  ).expect("This is a test file used in testing"),

  // Synchronously read file content with reference to File object
  new Test("readFileFromFile",
    () => {
      let file = _ucUtils.getFSEntry("test_file.txt");
      return _ucUtils.readFile(file);
    }
  ).expect("This is a test file used in testing"),

  // Async file read with string argument as relative path
  new Test(
    "readFileAsync",
    () => { return _ucUtils.readFileAsync("test_file.txt") }
  ).expectAsync("This is a test file used in testing"),

  // Async file read as json
  new Test(
    "readJSON",
    () => {
      return new Promise((resolve, reject) => {
        _ucUtils.readJSON("test_json.json")
        .then(some => resolve(some.property))
        .catch(reject)
      })
    }
  ).expectAsync("This is a test file used in testing"),

  // Write some content to text file
  new Test(
    "writeFileBasic",
    () => {
      return new Promise((resolve, reject) => {
        let bytes = null;
        _ucUtils.writeFile("write_test_basic.txt","test file content")
        .then(some => { bytes = some })
        .then(() => _ucUtils.readFileAsync("write_test_basic.txt"))
        .then((text) => resolve(text + ": " + bytes) )
        .catch(reject)
      })
    }
  ).expectAsync("test file content: 17"),

  // List names of files in a directory
  new Test("listFileNames",
    () => {
      let files = _ucUtils.getFSEntry("../");
      let names = [];
      while(files.hasMoreElements()){
        let file = files.getNext().QueryInterface(Ci.nsIFile);
        if(file.isFile()){
          names.push(file.leafName);
        }
      }
      return names.join(",");
    }
  ).expect("userChrome.css"),

  // TODO createFileURI

  // List folder names inside "chrome" directory
  new Test(
    "getChromeDir",
    () => {
      let items = _ucUtils.chromeDir.files;
      let names = [];
      while(items.hasMoreElements()){
        let file = items.getNext().QueryInterface(Ci.nsIFile);
        if(file.isDirectory()){
          names.push(file.leafName);
        }
      }
      return names.join(",");
    }
  ).expect("resources,tests,utils"),

  // Get File object from file name
  new Test(
    "getFSEntry",
    () => { return _ucUtils.getFSEntry("test_file.txt") != null }
  ).expect(true),

  // TODO togglescript

  // Set the pref to false (if it wasn't already) for the following tests
  Promise.resolve(_ucUtils.prefs.set(PREF_ALLLOW_UNSAFE,false)),

  // Writing outside of resources directory should fail because pref is disabled
  new Test(
    "excpectError_writeUserChromeCSS_BeforeStartup",
    () => {
      return _ucUtils.writeFile("../userChrome.css","#nav-bar{ background: #f00 !important; }")
    }
  ).expectError(),
  
  // This test should resolve after updateStyleSheet test has set the allow-unsafe pref to true
  new Test(
    "prefChangedToTrue",
    () => {
      return new Promise((resolve, reject) => {
        PREF_LISTENER.listenOnce((val,pref) => resolve(`${pref},${val}`));
        Test.resolveOnTimeout(2000).then(reject);
      })
    }
  ).expectAsync(PREF_ALLLOW_UNSAFE+",true"),
  
  // Set pref to allow writing outside of resources directory, and then write userChrome.css
  new Test(
    "updateStyleSheet",
    () => {
      _ucUtils.prefs.set(PREF_ALLLOW_UNSAFE,true);
      const getNavBarStyle = () => window.getComputedStyle(document.getElementById("nav-bar"));
      
      return new Promise((resolve, reject) => {
        _ucUtils.windowIsReady(window)
        .then( () => {
          // The color expected here is set in one of the tests that follow
          let oldColor = getNavBarStyle().backgroundColor;
          _ucUtils.writeFile("../userChrome.css","#nav-bar{ background: #ba5 !important; }")
          .then(() => _ucUtils.updateStyleSheet())
          .then(()=>Test.resolveOnTimeout(2000)) // necessary because the style may not be applied immediately
          .then( () => resolve(oldColor + " : " + getNavBarStyle().backgroundColor) )
        })
        .catch(reject)
      })
    }
  ).expectAsync("rgb(255, 0, 0) : rgb(187, 170, 85)"),
  
  /**
   * ! Keep these below as the last tests ! 
   *
   * Restore old userChrome.css state
   * The above test setup sets pref to allow writing outside of resources
   * so this should succeed.
   */
   
   // This test should resolve after timeout because pref listener was removed
  new Test(
    "prefNotChangedToFalse",
    () => {
      return new Promise((resolve, reject) => {
        PREF_LISTENER.listenOnce(reject);
        Test.resolveOnTimeout(200).then(PREF_LISTENER.forgetAboutIt);
        Test.resolveOnTimeout(4200)
        .then(() => resolve(PREF_LISTENER.size()));
      })
    }
  ).expectAsync(1),
   
  new Test(
    "writeUserChromeCSS",
    () => {
      return new Promise((resolve, reject) => {
        Test.resolveOnTimeout(4000)
        .then(() => {
          return _ucUtils.writeFile("../userChrome.css","#nav-bar{ background: #f00 !important; }")
        })
        .then(resolve)
        .catch(reject)
      })
    }
  ).expectAsync(40) // 40 bytes written
  // Set allowUnsafeWrites pref back to false
  .then(() => _ucUtils.prefs.set(PREF_ALLLOW_UNSAFE,false))
  .then(() => {
    // Check that writing userChrome.css now fails again
    new Test(
      "excpectError_writeUserChromeCSS_AfterStartup",
      () => {
        return _ucUtils.writeFile("../userChrome.css","#nav-bar{ background: #f00 !important; }")
      }
    ).expectError()
  })
  
  ];
  
  Test.waitForTestSet(PROMISES)
  .finally(() => PREF_LISTENER.reset());
  
})();