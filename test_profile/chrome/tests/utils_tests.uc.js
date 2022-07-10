// ==UserScript==
// @name           test_utils
// @onlyonce
// @loadOrder 5
// ==/UserScript==

"use strict";

(function(){
  
  const BRAND_NAME = "Firefox Nightly";
  const SHARED_GLOBAL_TEST_X = 42;

  const { Test } = ChromeUtils.importESModule("chrome://userscripts/content/000_test_runner.sys.mjs");

  // Write some stuff to sharedGlobal
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

  // Can we read data from sharedGlobal
  new Test(
    "sharedGlobal",
    () => { return _ucUtils.sharedGlobal.test_utils.x }
  ).expect(SHARED_GLOBAL_TEST_X);

  // Does _ucUtils give us correct brandName
  new Test(
    "brandName",
    () => { return _ucUtils.brandName }
  ).expect(BRAND_NAME);

  // calling createElement() without third argument should create a xul element
  new Test(
    "createXulElement",
    () => {
      let node = _ucUtils.createElement(
        document,
        "vbox",
        { class: "test-vbox", "hidden": true }
      );
      return node.outerHTML;
    }
  ).expect('<vbox xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul" class="test-vbox" hidden="true"/>');

  // calling createElement() with third argument should create html element
  new Test(
    "createHTMLElement",
    () => {
      let node = _ucUtils.createElement(
        document,
        "div",
        { class: "test-div", "hidden": true },
        true
      );
      return node.outerHTML;
    }
  ).expect('<div xmlns="http://www.w3.org/1999/xhtml" class="test-div" hidden="true"></div>');

  // TODO createWidget

  // Synchronously read file content with string argument treated as relative path
  new Test(
    "readFileFromString",
    () => { return _ucUtils.readFile("test_file.txt") }
  ).expect("This is a test file used in testing");

  // Synchronously read file content with reference to File object
  new Test("readFileFromFile",
    () => {
      let file = _ucUtils.getFSEntry("test_file.txt");
      return _ucUtils.readFile(file);
    }
  ).expect("This is a test file used in testing");

  // Async file read with string argument as relative path
  new Test(
    "readFileAsync",
    () => { return _ucUtils.readFileAsync("test_file.txt") }
  ).expectAsync("This is a test file used in testing");

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
  ).expectAsync("This is a test file used in testing");

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
  ).expectAsync("test file content: 17");

  // List names of files in a directory
  new Test("listFileNames",
    () => {
      let files = _ucUtils.getFSEntry("../tests/");
      let names = [];
      while(files.hasMoreElements()){
        let file = files.getNext().QueryInterface(Ci.nsIFile);
        if(file.isFile()){
          names.push(file.leafName);
        }
      }
      return names.join(",");
    }
  ).expect(TEST_FILES.join(","));

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
  ).expect("resources,tests,utils");

  // Get File object from file name
  new Test(
    "getFSEntry", () => { return _ucUtils.getFSEntry("test_file.txt") != null }
  ).expect(true);

  // return list of script names in directory (not file names)
  // Note: aaa_test_script.uc.js does not have a name so it should be first
  new Test(
    "getScriptData",
    () => {
      let scripts = _ucUtils.getScriptData();
      const names = scripts.sort((a, b) => (a.name < b.name ? -1 : 1))
                    .map(a => a.name)
                    .join(",")
      return scripts.length + ";" + names
    }
  ).expect(TEST_FILES.length+";,test_module_script,test_module_script_ESM,test_runner,test_utils");

  // Tests load order.
  // The current script (this one) should be false.
  // background-modules should be true
  // scripts that have not been run yet should be false.
  // NOTE: this script has @loadOrder 5 thus none of the non-backgroundmodules should have been run yet
  // This test assumes that none of the test scripts have been manually disabled
  new Test(
    "getScriptLoadOrder",
    () => {
      let scripts = _ucUtils.getScriptData();
      return  scripts.sort((a, b) => (a.name < b.name ? -1 : 1))
              .map(a => a.isRunning)
              .join(",");
    }
  ).expect("false,true,true,true,false");

  // Can get reference to first browser-window window-object
  new Test(
    "getWindows",
    () => {
      return _ucUtils.windows.get()[0].AppConstants.MOZ_APP_BASENAME;
    }
  ).expect("Firefox");

  // TODO togglescript

  // Set the pref to false (if it wasn't already) for the following tests
  _ucUtils.prefs.set("userChromeJS.allowUnsafeWrites",false);

  // Writing outside of resources directory should fail because pref is disabled
  new Test(
    "excpectError_writeUserChromeCSS_BeforeStartup",
    () => {
      return _ucUtils.writeFile("../userChrome.css","#nav-bar{ background: #f00 !important; }")
    }
  ).expectError();

  // Set pref to allow writing outside of resources directory, and then write userChrome.css
  new Test(
    "updateStyleSheet",
    () => {
      _ucUtils.prefs.set("userChromeJS.allowUnsafeWrites",true);
      const getNavBarStyle = () => window.getComputedStyle(document.getElementById("nav-bar"));
      
      return new Promise((resolve, reject) => {
        _ucUtils.windowIsReady(window)
        .then( () => {
          // The color expected here is set in one of the tests that follow
          let oldColor = getNavBarStyle().backgroundColor;
          _ucUtils.writeFile("../userChrome.css","#nav-bar{ background: #ba5 !important; }")
          .then(() => _ucUtils.updateStyleSheet())
          .then(Test.createTimeout) // necessary because the style may not be applied immediately
          .then( () => resolve(oldColor + " : " + getNavBarStyle().backgroundColor) )
        })
        .catch(reject)
      })
    }
  ).expectAsync("rgb(255, 0, 0) : rgb(187, 170, 85)");

  // TODO updateMenuStatus

  // Should resolve startupFinished when startup has been finished
  new Test(
    "startupFinished",
    () => {
      return new Promise((resolve ,reject) => {
        setTimeout(reject, 8000); // Startup should not take 8 seconds
        _ucUtils.startupFinished()
        .then(() => resolve(42))
      })
    }
  ).expectAsync(42);

  // Has current window object been fully restored 
  new Test(
    "WindowIsReady",
    () => {
      return new Promise((resolve, reject) => {
        setTimeout(reject, 8000);
        _ucUtils.windowIsReady(window)
        .then(() => resolve(42))
      })
    }
  ).expectAsync(42);

  new Test(
    "registerHotkey",
    () => {
      let details = {
        id: "myHotkey",
        modifiers: "ctrl shift",
        key: "Y"
      };
      
      let val = _ucUtils.registerHotkey(details,() => ({}) );
      if(!val){
        return false
      }
      let key = document.getElementById("myHotkey");
      return key.getAttribute("modifiers") + "," + key.getAttribute("key");
    }
  ).expect("accel,shift,Y");

  // TODO loadURI

  // TODO showNotification

  new Test(
    "CancelRestart",
    () => {
      
      return new Promise((resolve ,reject) => {
        let reason = null;
        
        let cancelObserver = (subject, topic, data) => {
          subject.data = true;
          reason = data;
          Services.obs.removeObserver(cancelObserver, "quit-application-requested");
        };
        
        Services.obs.addObserver(cancelObserver, "quit-application-requested");
        
        Test.createTimeout()
        .then(_ucUtils.restart)
        .then(
          some => resolve( `${reason} ${some ? "succeeded" : "canceled"}` )
        ).catch(reject)
      })
    }
  ).expectAsync("restart canceled");
  
  /**
   * ! Keep these below as the last tests ! 
   *
   * Restore old userChrome.css state
   * The above test setup sets pref to allow writing outside of resources
   * so this should succeed.
   */
  new Test(
    "writeUserChromeCSS",
    () => {
      return new Promise((resolve, reject) => {
        Test.createTimeoutLong()
        .then(() => {
          return _ucUtils.writeFile("../userChrome.css","#nav-bar{ background: #f00 !important; }")
        })
        .then(resolve)
        .catch(reject)
      })
    }
  ).expectAsync(40) // 40 bytes written
  // Set allowUnsafeWrites pref back to false
  .then(() => _ucUtils.prefs.set("userChromeJS.allowUnsafeWrites",false))
  .then(() => {
    // Check that writing userChrome.css now fails again
    new Test(
      "excpectError_writeUserChromeCSS_AfterStartup",
      () => {
        return _ucUtils.writeFile("../userChrome.css","#nav-bar{ background: #f00 !important; }")
      }
    ).expectError()
  })
  .then(Test.logResults);
  
})();
