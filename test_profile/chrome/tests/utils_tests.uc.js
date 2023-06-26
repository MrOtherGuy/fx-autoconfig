// ==UserScript==
// @name           test_utils
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
  "test_mjs.uc.mjs",
  "test_module_script.sys.mjs",
  "test_module_script.uc.js",
  "test_registering_manifest",
  "legacy_tests.uc.js",
  "utils_tests.uc.js",
  "write_to_shared.uc.js",
  "x_disabled_test.uc.js"
  ];
  console.info("%crunning tests...","color: rgb(120,160,240)");
  
  const PROMISES = [
  // Can we read data from sharedGlobal
  // The value should have been set by write_to_shared.uc.js which should have run before this one.
  new Test(
    "sharedGlobal",
    () => { return _ucUtils.sharedGlobal.test_utils.x }
  ).expect(42),

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

  // Test if widget is created by inspecting if it has expected fill style
  new Test(
    "createWidget",
    () => {
      return new Promise((resolve, reject) => {
        const widgetID = "test-widget-too";
        
        const listener = {
          onWidgetAfterDOMChange: (aNode) => {
            if(aNode.id === widgetID){
              window.CustomizableUI.removeListener(listener);
              try{
                resolve(window.getComputedStyle(aNode.icon).fill)
              }catch(ex){
                reject(ex)
              }
            }
          }
        };
        window.CustomizableUI.addListener(listener);
        
        let widget = _ucUtils.createWidget({
          id: widgetID,
          type: "toolbarbutton",
          label: "my-widget-label-too",
          tooltip: "test-tooltip",
          class: "test-button",
          image: "chrome://browser/skin/bookmark-star-on-tray.svg",
          style: "--toolbarbutton-icon-fill: #f0f; color: #f0f;",
          callback: function(ev,win){
            console.log(win.document.title)
          }
        });
        
      });
    }
  ).expectAsync("rgb(255, 0, 255)"),

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

  // Synchronously read file content from fsResult
  new Test("readFileFromFSResult",
    () => {
      let fsResult = _ucUtils.fs.getEntry("test_file.txt");
      return fsResult.readSync();
    }
  ).expect("This is a test file used in testing"),

  // Async file read with string argument as relative path
  new Test(
    "readFileAsync",
    () => { return _ucUtils.fs.readFile("test_file.txt") }
  ).expectAsync(fsResult => fsResult.content() === "This is a test file used in testing"),

  // Asynchronously read file content from fsResult
  new Test("readFileFromFSResultAsync",
    () => {
      let fsResult = _ucUtils.fs.getEntry("test_file.txt");
      return fsResult.read();
    }
  ).expectAsync("This is a test file used in testing"),

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
  ).expect("resources,tests,utils"),

  // Get File object from file name
  new Test(
    "getFSEntry",
    () => { return _ucUtils.fs.getEntry("test_file.txt").isFile() }
  ).expect(true),
  
  new Test(
    "getFileURIFromFile",
    () => { return _ucUtils.fs.getEntry("test_file.txt").fileURI }
  ).expect(`${_ucUtils.fs.BASE_FILEURI}resources/test_file.txt`),
    
  new Test(
    "getFileURIFromContent",
    () => {
      return new Promise(resolve => {
        _ucUtils.fs.readFile("test_file.txt")
        .then(result => resolve(result.fileURI))
      })
    }
  ).expectAsync(`${_ucUtils.fs.BASE_FILEURI}resources/test_file.txt`),
    
  new Test(
    "getFileURIFromContentSync",
    () => {
      return _ucUtils.fs.readFileSync("test_file.txt").fileURI
    }
  ).expect(`${_ucUtils.fs.BASE_FILEURI}resources/test_file.txt`),
  
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
  ).expect(TEST_FILES.length+";,test_module_script,test_module_script_ESM,test_non_background_mjs,test_registering_manifest,test_runner,test_utils,test_utils_legacy,write-42,x_disabled"),

  // Tests load order.
  // The current script (this one) should be false.
  // background-modules should be true
  // scripts that have not been run yet should be false.
  // NOTE: this script has @loadOrder 5 thus none of the non-backgroundmodules  
  // should have been run yet - except write_to_shared.uc.js which should run
  // before this because we check if we can read the value it sets from sharedGlobal
  // This test assumes that none of the test scripts have been manually disabled
  new Test(
    "getScriptLoadOrder",
    () => {
      let scripts = _ucUtils.getScriptData();
      return  scripts.sort((a, b) => (a.name < b.name ? -1 : 1))
              .map(a => a.isRunning)
              .join(",");
    }
  ).expect("false,true,true,false,false,true,false,false,true,false"),
  
  // Test invalid getScriptData() filter 1
  new Test(
    "expectError_unsupportedScriptDataFilterNumber",
    () => _ucUtils.getScriptData(123)
  ).expectError(),
  
  // Test invalid getScriptData() filter 2
  new Test(
    "expectError_unsupportedScriptDataFilterObject",
    () => _ucUtils.getScriptData({})
  ).expectError(),
  
  // Test getting single ScriptInfo object
  new Test(
    "getSingleScriptInfo",
    () => _ucUtils.getScriptData("test_module_script.sys.mjs").name
  ).expect("test_module_script_ESM"),
  
  // Test getting non-existing ScriptInfo object
  new Test(
    "getNonExistingScriptInfo",
    () => _ucUtils.getScriptData("non-existing-name")
  ).expect(null),
  
  // Test getting ScriptInfo from string
  new Test(
    "getScriptInfoFromString",
    () => {
      const headertext = `// ==UserScript==
// @name           fake-text
// @description    hello world!
// @loadOrder 5
// ==/UserScript==
`;
      return _ucUtils.parseStringAsScriptInfo("fake-file.txt",headertext);
    }
  ).expect( scriptInfo => {
    return scriptInfo.filename === "fake-file.txt"
            && scriptInfo.isRunning === false
            && scriptInfo.noExec === true
            && scriptInfo.regex.test("chrome://browser/content/browser.xhtml")
            && scriptInfo.loadOrder === 5
  }),
  
  // Test getting ScriptInfo from filter function
  new Test(
    "getScriptInfoWithFilter",
    () => _ucUtils.getScriptData(s => s.inbackground).length
  ).expect(3),
  
  // test single-line script descriptions
  new Test(
    "single-line script descriptions",
    () => _ucUtils.getScriptData("000_test_runner.sys.mjs")?.description
  ).expect("module which runs and logs test results"),
  
  // test multi-line script descriptions
  new Test(
    "multi-line script descriptions",
    () => {
      let script = _ucUtils.getScriptData("utils_tests.uc.js");
      return script ? script.description.split("\n") : [];
    }
  ).expect(lines => {
    return lines.length === 6
        && lines[lines.length - 1] === "Above line is also left empty";
  }),
  
  // Can get reference to first browser-window window-object
  new Test(
    "getWindows",
    () => {
      return _ucUtils.windows.get()[0].AppConstants.MOZ_APP_BASENAME;
    }
  ).expect((val) => val === "Firefox"),

  // TODO togglescript

  // Set the pref to false (if it wasn't already) for the following tests
  Promise.resolve(_ucUtils.prefs.set(PREF_ALLLOW_UNSAFE,false)),

  // Writing outside of resources directory should fail because pref is disabled
  new Test(
    "excpectError_writeUserChromeCSS_BeforeStartup",
    () => {
      return _ucUtils.fs.writeFile("../userChrome.css","#nav-bar{ background: #f00 !important; }")
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
          _ucUtils.fs.writeFile("../userChrome.css","#nav-bar{ background: #ba5 !important; }")
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
  ).expectAsync((val) => val === 42),

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
          return _ucUtils.fs.writeFile("../userChrome.css","#nav-bar{ background: #f00 !important; }")
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
        return _ucUtils.fs.writeFile("../userChrome.css","#nav-bar{ background: #f00 !important; }")
      }
    ).expectError()
  })
  
  ];
  
  Test.waitForTestSet(PROMISES)
  .finally(() => PREF_LISTENER.reset());
  
})();
