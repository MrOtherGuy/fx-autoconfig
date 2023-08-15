// ==UserScript==
// @name           test_utils
// @onlyonce
// @loadOrder 5
// ==/UserScript==

"use strict";

(function(){
  
  const BRAND_NAME = "Thunderbird";
  const PREF_ALLLOW_UNSAFE = "userChromeJS.allowUnsafeWrites";
  const SHARED_GLOBAL_TEST_X = 42;

  const { Test } = ChromeUtils.importESModule("chrome://userscripts/content/000_test_runner.sys.mjs");

  // Write some stuff to sharedGlobal
  _ucUtils.sharedGlobal.test_utils = { x: SHARED_GLOBAL_TEST_X };

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
  const TEST_FILES = [
  "000_test_runner.sys.mjs",
  "aaa_test_script.uc.js",
  "test_module_script.uc.js",
  "utils_tests.uc.js"
  ];
  console.info("%crunning tests...","color: rgb(120,160,240)");
  const PROMISES = [
  // Can we read data from sharedGlobal
  new Test(
    "sharedGlobal",
    () => { return _ucUtils.sharedGlobal.test_utils.x }
  ).expect(SHARED_GLOBAL_TEST_X),

  // Does _ucUtils give us correct brandName
  new Test(
    "brandName",
    () => { return _ucUtils.brandName }
  ).expect(BRAND_NAME),

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
  ).expect('<vbox xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul" class="test-vbox" hidden="true"/>'),

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
  ).expect('<div xmlns="http://www.w3.org/1999/xhtml" class="test-div" hidden="true"></div>'),

  // TODO createWidget

  // Synchronously read file content with string argument treated as relative path
  new Test(
    "readFileFromString",
    () => { return _ucUtils.fs.readFileSync("test_file.txt").content() }
  ).expect("This is a test file used in testing"),

  // Synchronously read file content with reference to File object
  new Test("readFileFromFile",
    () => {
      let fsResult = _ucUtils.fs.getEntry("test_file.txt");
      return _ucUtils.fs.readFileSync(fsResult.entry()).content();
    }
  ).expect("This is a test file used in testing"),

  // Async file read with string argument as relative path
  new Test(
    "readFileAsync",
    () => { return _ucUtils.fs.readFile("test_file.txt") }
  ).expectAsync(fsResult => fsResult.content() === "This is a test file used in testing"),

  // Async file read as json
  new Test(
    "readJSON",
    () => {
      return new Promise((resolve, reject) => {
        _ucUtils.fs.readJSON("test_json.json")
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
        _ucUtils.fs.writeFile("write_test_basic.txt","test file content")
        .then(some => { bytes = some })
        .then(() => _ucUtils.fs.readFile("write_test_basic.txt"))
        .then((fsResult) => resolve(fsResult.content() + ": " + bytes) )
        .catch(reject)
      })
    }
  ).expectAsync("test file content: 17"),

  // List names of files in a directory
  new Test("listFileNames",
    () => {
      let names = [];
      for(let entry of _ucUtils.fs.getEntry("../")){
        if(entry.isFile()){
          names.push(entry.leafName);
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
      let names = [];
      for(let entry of _ucUtils.fs.chromeDir()){
        if(entry.isDirectory()){
          names.push(entry.leafName);
        }
      }
      return names.join(",");
    }
  ).expect("css,resources,tests,utils"),

  // Get File object from file name
  new Test(
    "getFSEntry",
    () => { return _ucUtils.fs.getEntry("test_file.txt").isFile() }
  ).expect(true),

  // return list of script names in directory (not file names)
  // Note: aaa_test_script.uc.js does not have a name so it should be first
  new Test(
    "getScriptData",
    () => {
      let scripts = _ucUtils.getScriptData();
      const names = scripts
      .sort((a, b) => (a.name < b.name ? -1 : 1))
      .map(a => a.name)
      .join(",")
      return scripts.length + ";" + names
    }
  ).expect(TEST_FILES.length+";,test_module_script,test_runner,test_utils"),

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
      return scripts
      .sort((a, b) => (a.name < b.name ? -1 : 1))
      .map(a => a.isRunning)
      .join(",");
    }
  ).expect("false,true,true,false"),

  // Can get reference to first browser-window window-object
  new Test(
    "getWindows",
    () => {
      return _ucUtils.windows.get()[0].AppConstants.MOZ_APP_BASENAME;
    }
  ).expect("Thunderbird"),

  // TODO togglescript

  // Set the pref to false (if it wasn't already) for the following tests
  Promise.resolve(_ucUtils.prefs.set(PREF_ALLLOW_UNSAFE,false)),

  // Writing outside of resources directory should fail because pref is disabled
  new Test(
    "excpectError_writeUserChromeCSS_BeforeStartup",
    () => {
      return _ucUtils.fs.writeFile("../userChrome.css","#navigation-toolbox{ background: #f00 !important; }")
    }
  ).expectError(),
  
  // This test should resolve after updateStyleSheet test has set the allow-unsafe pref to true
  new Test(
    "prefChangedToTrue",
    () => {
      return new Promise((resolve, reject) => {
        PREF_LISTENER.listenOnce((val,pref) => resolve(`${pref},${val.value}`));
        Test.resolveOnTimeout(2000).then(reject);
      })
    }
  ).expectAsync(PREF_ALLLOW_UNSAFE+",true"),
  
  // Set pref to allow writing outside of resources directory, and then write userChrome.css
  new Test(
    "updateStyleSheet",
    () => {
      _ucUtils.prefs.set(PREF_ALLLOW_UNSAFE,true);
      const getNavBarStyle = () => window.getComputedStyle(document.getElementById("navigation-toolbox"));
      
      return new Promise((resolve, reject) => {
        _ucUtils.windowIsReady(window)
        .then( () => {
          // The color expected here is set in one of the tests that follow
          let oldColor = getNavBarStyle().backgroundColor;
          _ucUtils.fs.writeFile("../userChrome.css","#navigation-toolbox{ background: #ba5 !important; }")
          .then(() => _ucUtils.updateStyleSheet())
          .then(()=>Test.resolveOnTimeout(2000)) // necessary because the style may not be applied immediately
          .then( () => resolve(oldColor + " : " + getNavBarStyle().backgroundColor) )
        })
        .catch(reject)
      })
    }
  ).expectAsync("rgb(255, 0, 0) : rgb(187, 170, 85)"),

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
  ).expectAsync(42),

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
  ).expectAsync(42),

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
  ).expect("accel,shift,Y"),

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
        
        Test.resolveOnTimeout(2000)
        .then(_ucUtils.restart)
        .then(
          some => resolve( `${reason} ${some ? "succeeded" : "canceled"}` )
        ).catch(reject)
      })
    }
  ).expectAsync("restart canceled"),
  
  /**
   * ! Keep these below as the last tests ! 
   *
   * Restore old userChrome.css state
   * The above test setup sets pref to allow writing outside of resources
   * so this should succeed.
   */
  // This test should resolve after timeout because pref listener was removed
   // Note: this test will fail if pref "userChromeJS.firstRunShown" isn't set on startup
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
          return _ucUtils.fs.writeFile("../userChrome.css","#navigation-toolbox{ background: #f00 !important; }")
        })
        .then(resolve)
        .catch(reject)
      })
    }
  ).expectAsync(51) // 50 bytes written
  // Set allowUnsafeWrites pref back to false
  .then(() => _ucUtils.prefs.set(PREF_ALLLOW_UNSAFE,false))
  .then(() => {
    // Check that writing userChrome.css now fails again
    new Test(
      "excpectError_writeUserChromeCSS_AfterStartup",
      () => {
        return _ucUtils.fs.writeFile("../userChrome.css","#navigation-toolbox{ background: #f00 !important; }")
      }
    ).expectError()
  })
  
  ];
  
  Test.waitForTestSet(PROMISES)
  .finally(() => PREF_LISTENER.reset());
  
})();
