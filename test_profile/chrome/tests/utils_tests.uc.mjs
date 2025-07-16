// ==UserScript==
// @name           utils_tests.uc.mjs
// @onlyonce
// @long-description
// @description    fallback for loaders without multi-line parsing
/*
This file is used to run various tests where main purpose
is to test APIs provided by UC_API.

Above line is left empty on purpose to test multi-line descriptions.
 
Above line is also left empty
*/
// @loadOrder 5
// ==/UserScript==

"use strict";
import {
  FileSystem,
  Hotkeys,
  Notifications,
  Prefs,
  Scripts,
  SharedStorage,
  Runtime,
  Utils,
  Windows
} from "chrome://userchromejs/content/uc_api.sys.mjs";

  
const BRAND_NAME = "Firefox Nightly";
const PREF_ALLLOW_UNSAFE = "userChromeJS.allowUnsafeWrites";
const RESOURCE_SPEC = FileSystem.RESOURCE_URI.spec;

const { Test } = ChromeUtils.importESModule("chrome://userscripts/content/000_test_runner.sys.mjs");


const PREF_LISTENER = new (function(){
  let clients = new Set();
  let listener = Prefs.addListener("userChromeJS",(value, prefName) => {
    for(let client of clients){
      client(value,prefName);
    }
    clients.clear()
  });
  this.listenOnce = (fun) => {
    clients.add(fun);
  }
  this.forgetAboutIt = () => {
    Prefs.removeListener(listener);
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
"utils_tests.uc.mjs",
"write_to_shared.uc.js",
"x_disabled_system_module",
"x_disabled_test.uc.js"
];
console.info("%crunning UC_API tests...","color: rgb(120,160,240)");

const PROMISES = [
// Can we read data from SharedStorage
// The value should have been set by write_to_shared.uc.js which should have run before this one.
new Test(
  "SharedStorage",
  () => { return SharedStorage.test_utils.x }
).expect(42),

new Test(
  "SharedStorage_got_ESM_set_value",
  () => { return SharedStorage.test_module_script_ESM.y }
).expect(42),

new Test(
  "SharedStorage_size_equals_2",
  () => { return Object.keys(SharedStorage.debug()).length }
).expect(2),

new Test(
  "SharedStorage_is_empty",
  () => {
    SharedStorage.clear();
    return Object.keys(SharedStorage.debug()).length
  }
).expect(0),

new Test(
  "SharedStorage_storageChange_event",
  () => {
    return new Promise((resolve,reject) => {
      SharedStorage.set("test_thing",123);
      let listener = changes => {
        SharedStorage.onChanged.removeListener(listener);
        if(SharedStorage.onChanged.hasListener(listener)){
          reject("SharedStorage listener still exists!")
        }else{
          resolve(changes);
        }
      };
      SharedStorage.onChanged.addListener(listener);
      setTimeout(() => { SharedStorage.test_thing = 42 },10)
    })
  }
).expectAsync(changes => {
  return changes.test_thing.oldValue === 123 && changes.test_thing.newValue === 42
}),

// Does _ucUtils give us correct brandName
new Test(
  "brandName",
  () => { return Runtime.brandName }
).expect(BRAND_NAME),

// calling createElement() without third argument should create a xul element
new Test(
  "createXulElement",
  () => {
    let node = Utils.createElement(
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
    let node = Utils.createElement(
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
              resolve(
                aNode.getAttribute("command") + ";"
                + aNode.getAttribute("image") + ";"
                + window.getComputedStyle(aNode.icon).fill
              )
            }catch(ex){
              reject(ex)
            }
          }
        }
      };
      window.CustomizableUI.addListener(listener);
      
      let widget = Utils.createWidget({
        id: widgetID,
        type: "toolbarbutton",
        label: "my-widget-label-too",
        tooltip: "test-tooltip",
        class: "test-button",
        image: "chrome://browser/skin/bookmark-star-on-tray.svg",
        style: "--toolbarbutton-icon-fill: #f0f; color: #f0f;",
        callback: function(ev,win){
          console.log(win.document.title)
        },
        command: "Browser:Screenshot"
      });
      
    });
  }
).expectAsync("Browser:Screenshot;chrome://browser/skin/bookmark-star-on-tray.svg;rgb(255, 0, 255)"),

// Synchronously read file content with string argument treated as relative path
new Test(
  "readFileFromString",
  () => { return FileSystem.readFileSync("test_file.txt").content() }
).expect("This is a test file used in testing"),

// Synchronously read file content with reference to File object
new Test("readFileFromFile",
  () => {
    let fsResult = FileSystem.getEntry("test_file.txt");
    return FileSystem.readFileSync(fsResult.entry()).content();
  }
).expect("This is a test file used in testing"),

// Synchronously read file content from fsResult
new Test("readFileFromFSResult",
  () => {
    let fsResult = FileSystem.getEntry("test_file.txt");
    return fsResult.readSync();
  }
).expect("This is a test file used in testing"),

// Async file read with string argument as relative path
new Test(
  "readFileAsync",
  () => { return FileSystem.readFile("test_file.txt") }
).expectAsync(fsResult => fsResult.content() === "This is a test file used in testing"),

// Asynchronously read file content from fsResult
new Test("readFileFromFSResultAsync",
  () => {
    let fsResult = FileSystem.getEntry("test_file.txt");
    return fsResult.read();
  }
).expectAsync("This is a test file used in testing"),

// Async file read as json
new Test(
  "readJSON",
  () => {
    return new Promise((resolve, reject) => {
      FileSystem.readJSON("test_json.json")
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
      FileSystem.writeFile("write_test_basic.txt","test file content")
      .then(some => { bytes = some })
      .then(() => FileSystem.readFile("write_test_basic.txt"))
      .then((fsResult) => resolve(fsResult.content() + ": " + bytes) )
      .catch(reject)
    })
  }
).expectAsync("test file content: 17"),

// List names of files in a directory
new Test("listFileNames",
  () => {
    let names = [];
    for(let entry of FileSystem.getEntry("../")){
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
    for(let entry of FileSystem.chromeDir()){
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
  () => { return FileSystem.getEntry("test_file.txt").isFile() }
).expect(true),

new Test(
  "getFileURIFromFile",
  () => { return FileSystem.getEntry("test_file.txt").fileURI }
).expect(`${RESOURCE_SPEC}test_file.txt`),
  
new Test(
  "getFileURIFromContent",
  () => {
    return new Promise(resolve => {
      FileSystem.readFile("test_file.txt")
      .then(result => resolve(result.fileURI))
    })
  }
).expectAsync(`${RESOURCE_SPEC}test_file.txt`),
  
new Test(
  "getFileURIFromContentSync",
  () => {
    return FileSystem.readFileSync("test_file.txt").fileURI
  }
).expect(`${RESOURCE_SPEC}test_file.txt`),

new Test(
  "createEmptyFileURI",
  () => {
    return FileSystem.createFileURI("").split("/").slice(-4).join("/");
  }
).expect("test_profile/chrome/resources/"),

new Test(
  "createNonEmptyFileURI",
  () => {
    return FileSystem.createFileURI("test.txt").split("/").slice(-4).join("/");
  }
).expect("test_profile/chrome/resources/test.txt"),

// Check that correct error kind for non-existing entry
new Test(
  "getNonExistingFSEntry",
  () => { return FileSystem.getEntry("nonexistent.txt").error().kind }
).expect(FileSystem.ERROR_KIND_NOT_EXIST),

// Try to get file entry with invalid argument
new Test(
  "expectError_getFSEntryWithInvalidArgument",
  () => { return FileSystem.readFileSync([]) }
).expectError(),

// return list of script names in directory (not file names)
// Note: aaa_test_script.uc.js does not have a name so it should be first
new Test(
  "getScriptData",
  () => {
    let scripts = Scripts.getScriptData();
    const names = scripts
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .map(a => a.name)
    .join(",")
    return scripts.length + ";" + names
  }
).expect(TEST_FILES.length+";,test_module_script,test_module_script_ESM,test_non_background_mjs,test_registering_manifest,test_runner,test_utils,test_utils_legacy,write-42,x_disabled,x_disabled_system_module"),

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
    let scripts = Scripts.getScriptData();
    return  scripts.sort((a, b) => (a.name < b.name ? -1 : 1))
            .map(a => a.isRunning)
            .join(",");
  }
).expect("false,true,true,false,false,true,false,false,true,false,false"),

// Test invalid getScriptData() filter 1
new Test(
  "expectError_unsupportedScriptDataFilterNumber",
  () => Scripts.getScriptData(123)
).expectError(),

// Test invalid getScriptData() filter 2
new Test(
  "expectError_unsupportedScriptDataFilterObject",
  () => Scripts.getScriptData({})
).expectError(),

// Test getting single ScriptInfo object
new Test(
  "getSingleScriptInfo",
  () => Scripts.getScriptData("test_module_script.sys.mjs").name
).expect("test_module_script_ESM"),

// Test getting non-existing ScriptInfo object
new Test(
  "getNonExistingScriptInfo",
  () => Scripts.getScriptData("non-existing-name")
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
    return Scripts.parseStringAsScriptInfo("fake-file.txt",headertext);
  }
).expect( scriptInfo => {
  return scriptInfo.filename === "fake-file.txt"
          && scriptInfo.isRunning === false
          && scriptInfo.noExec === true
          && scriptInfo.regex === null
          && scriptInfo.loadOrder === -1
}),

// Test ScriptInfo where default regex should be created
new Test(
  "getScriptInfoFromStringWithoutNoExec",
  () => {
    const headertext = `// ==UserScript==
// @name           fake-text-2
// @description    hello world 2!
// @loadOrder 5
// ==/UserScript==
console.log("hello world!")
`;
    return Scripts.parseStringAsScriptInfo("fake-file.txt",headertext);
  }
).expect( scriptInfo => {
  return scriptInfo.filename === "fake-file.txt"
          && scriptInfo.isRunning === false
          && scriptInfo.noExec === false
          && scriptInfo.regex.test("chrome://browser/content/browser.xhtml")
          && scriptInfo.loadOrder === 5
}),

// Test getting ScriptInfo from filter function
new Test(
  "getScriptInfoWithFilter",
  () => Scripts.getScriptData(s => s.inbackground).length
).expect(4),

// Test getting correct chromeURI via ScriptInfo
new Test(
  "getScriptInfoChromeURI",
  () => Scripts.getScriptData("utils_tests.uc.mjs").chromeURI
).expect("chrome://userscripts/content/utils_tests.uc.mjs"),

// Test getting correct chromeURI via ScriptInfo for styles
new Test(
  "getStyleInfo",
  () => Scripts.getStyleData().length
).expect(2),

// Test getting correct chromeURI via ScriptInfo for styles
new Test(
  "getStyleInfoChromeURI",
  () => Scripts.getStyleData("author_style.uc.css")?.chromeURI
).expect("chrome://userstyles/skin/author_style.uc.css"),

// Test if ScriptInfo can be converted to nsIFile
new Test(
  "ScriptInfoConvertedToNsIFile",
  () => Scripts.getStyleData("author_style.uc.css")?.asFile().exists()
).expect(true),

// test single-line script descriptions
new Test(
  "single-line script descriptions",
  () => Scripts.getScriptData("000_test_runner.sys.mjs")?.description
).expect("module which runs and logs test results"),

// test multi-line script descriptions
new Test(
  "multi-line script descriptions",
  () => {
    let script = Scripts.getScriptData("utils_tests.uc.mjs");
    return script ? script.description.split("\n") : [];
  }
).expect(lines => {
  return lines.length === 6
      && lines[lines.length - 1] === "Above line is also left empty";
}),

// TODO togglescript

// Check if script menu is available (this test runs in browser.xhtml context)
new Test(
  "getScriptMenu",
  () => {
    let before = document.getElementById("userScriptsMenu") ? 0 : 1;
    let after = Scripts.getScriptMenuForDocument(document).menupopup ? 2 : 0;
    return before + after;
  }).expect(3),

// Set the pref to false (if it wasn't already) for the following tests
Promise.resolve(Prefs.set(PREF_ALLLOW_UNSAFE,false)),

// Writing outside of resources directory should fail because pref is disabled
new Test(
  "excpectError_writeUserChromeCSS_BeforeStartup",
  () => {
    return FileSystem.writeFile("../userChrome.css","#nav-bar{ background: #f00 !important; }")
  }
).expectError(),

// This test should resolve after reloadStyleSheet test has set the allow-unsafe pref to true
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
  "reloadStyleSheet",
  () => {
    Prefs.set(PREF_ALLLOW_UNSAFE,true);
    const getNavBarStyle = () => window.getComputedStyle(document.getElementById("nav-bar"));
    
    return new Promise((resolve, reject) => {
      Windows.waitWindowLoading(window)
      .then( () => {
        // The color expected here is set in one of the tests that follow
        let oldColor = getNavBarStyle().backgroundColor;
        FileSystem.writeFile("../userChrome.css","#nav-bar{ background: #ba5 !important; }")
        .then(() => Scripts.reloadStyleSheet())
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
      Runtime.startupFinished()
      .then(() => resolve(42))
    })
  }
).expectAsync((val) => val === 42),

// Can get reference to first browser-window window-object
new Test(
  "windows.getAll",
  () => {
    return Windows.getAll()[0].AppConstants.MOZ_APP_BASENAME;
  }
).expect((val) => val === "Firefox"),

// Is this a browser window

new Test(
  "windows.isBrowserWindow",
  () => {
    return Windows.isBrowserWindow(window);
  }
).expect(true),

// Has current window object been fully restored 
new Test(
  "windows.waitWindowLoading",
  () => {
    return new Promise(async (resolve, reject) => {
      setTimeout(reject, 8000);
      let init1 = window.gBrowserInit.delayedStartupFinished;
      await Windows.waitWindowLoading(window);
      resolve( `${init1};${window.gBrowserInit.delayedStartupFinished}`)
    })
  }
).expectAsync("false;true"),

new Test(
  "hotkeys.define",
  async () => {
    let details = {
      id: "myHotkey",
      modifiers: "ctrl shift",
      key: "y",
      command: (win,ev) => { console.log(win.document.title)}
    };
    let hk = Hotkeys.define(details);
    hk.attachToWindow(window);
    await Windows.waitWindowLoading(window);
    let key = document.getElementById("myHotkey");
    return key.getAttribute("modifiers") + "," + key.getAttribute("key")+","+hk.matchingSelector;
  }
).expectAsync('accel,shift,Y,key[modifiers="accel,shift"][key="Y"]'),

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
      .then(Runtime.restart)
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
        return FileSystem.writeFile("../userChrome.css","#nav-bar{ background: #f00 !important; }")
      })
      .then(resolve)
      .catch(reject)
    })
  }
).expectAsync(40) // 40 bytes written
// Set allowUnsafeWrites pref back to false
.then(() => Services.prefs.clearUserPref(PREF_ALLLOW_UNSAFE))
.then(() => {
  // Check that writing userChrome.css now fails again
  new Test(
    "excpectError_writeUserChromeCSS_AfterStartup",
    () => {
      return FileSystem.writeFile("../userChrome.css","#nav-bar{ background: #f00 !important; }")
    }
  ).expectError()
})

];

Test.waitForTestSet(PROMISES)
.finally(() => PREF_LISTENER.reset());
  
