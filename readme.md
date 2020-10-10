# Yet another userChrome.js manager

The files in this repository create a toolkit to load arbitrary javascript files to be run in Firefox browser context. This method relies on autoconfig functionality available in Firefox.

# Overview

Files in `program` folder tell Firefox to load an additional javascript module file from the current Profile directory. The `boot.jsm` is the one tha implements loading and managing additional files.

Since the files in `program` go to the main program installation path, they will affect all profiles that are being run using that executable.

However, the bulk of the logic is located in profile folder with `boot.jsm` so if the file is not found there then the loader is simply not used.

## Warning!

Please note that malicious external programs can now inject custom logic to Firefox even without elevated privileges just by modifying boot.jsm or adding their own scripts.

# Install

## Setting up program

Copy the *contents* of the folder "program" (not the folder itself) to the program folder you want the changes to apply to.
That means the `config.js` should end up to the same folder where `firefox.exe` is located

## Setting up profile

Copy the contents of the folder "profile" (not the folder itself) to the Firefox profile folder that you want to modify. If the profile already has a `chrome` folder (for userChrome.css or userContent.css) then the chrome folders should merge. Otherwise the chrome folder will be created.
You should end up with `chrome` folder in the profile root, and three folders inside it - JS, resources and utils.

There will be two files in the `chrome/utils/` folder:

* `chrome.manifest` - registers file paths to chrome:// protocol
* `boot.jsm` - implements user-script loading logic

## Deleting startup-cache

Firefox caches some files to speed-up startup. But the files in utils/ modify the startup behavior so you might be required to manually delete the startup-cache.
The startup-cache folder can be found as follows:

1. load the following url `about:profiles`
2. locate the profile you wish to set up and click the "Open Folder" of the **Local** directory - this should open the directory in File Manager
3. Close Firefox
4. Delete folder "StartupCache"
5. Run Firefox

(Note) If you wish to set up a profile that doesn't use normal profile directories (i.e one that was lauched with command-line such as `firefox.exe -profile "C:\test\testprofile"` or with portable-apps launcher) then the startupCache folder will be in the profile root folder.

# Usage

The file extension for your custom scripts must be `.uc.js`

Just put any such files in the scripts folder inside chrome folder, same folder where userChrome.css would be. By default the scripts folder is named `JS` but this is customizable by modifying `chrome.manifest`. For example change `../JS/` to `../scripts/` to make Firefox load scripts from "scripts" folder.

At runtime, individual scripts can be toggled on/off from menubar -> tools -> userScripts. Note that toggling requires Firefox to be restarted, for which a "restart now" -button is provided. The button clears startup-cache so you don't need to worry about that.

A global preference to toggle all scripts is `userChromeJS.enabled`. This will disable all scripts but leaves the restart-button in the custom menu available.

# API

This manager is NOT entirely compatible with all existing userScripts - specifically scripts that expect a global _uc object or something similar to be available.

# Script scope

Each script normally runs once *per window* when it is created. This can be changed with `@onlyonce` header in which case the script will only be run in the first window. 

In addition, scripts can be marked as `@backgroundmodule` in which case they are executed "outside" of window when the the loader reads the file. See **backgroundmodule** section below.

Some convenience functions are provided for scripts to use in global `_ucUtils` object available in windows.

## backgroundmodule

Scripts can be marked as background modules by including a `@backgroundmodule` line in script header. See example:

```js
// ==UserScript==
// @name           example background module
// @note           Loading as background module
// @backgroundmodule
// ==/UserScript==

let EXPORTED_SYMBOLS = [];
...
// actual script here

```
Note that the `EXPORTED_SYMBOLS` array in module global scope is mandatory.

You should note that background modules do not have access to window objects when they are being run because they are executed before any window exists. They also do not get access to `_ucUtils` object.

## General

### _ucUtils.createElement(document,tagname,attributes,isHTML) -> Element

    _ucUtils.createElement(document,"menuitem",{ id:"someid", class:"aClass", label:"some label" })

Attaches a new element with tagname to the given document and adds it attributes from attributes object. isHTML is a boolean indicating whether the element is XUL element or HTML element - defaults to false.

### _ucUtils.createWidget(details) -> <Widget wrapper object> (or null on failure)

    _ucUtils.createWidget({
      id: "funk-item",                // required
      type: "toolbaritem",            // ["toolbaritem","toolbarbutton"]  
      label: "funky2",                // opt (uses id when missing)
      tooltip: "noiseButton",         // opt (uses id when missing)
      class: "noiseButton",           // opt additional className (see below for more)
      image: "favicon.png",           // opt image filename from resources folder
      style: "width:30px;",           // opt additional css-text (see below for more)
      allEvents: true,                // opt trigger on all clicks (default false)
      callback: function(ev,win){     // Function to be called when the item is clicked
        console.log(ev.target.id)
      }
    })

Widget is a wrapper for actual elements. Firefox tracks widget placements *across windows* meaning that you can create the widget once and then you can re-position it using customize mode and its new location will be shared in all windows. The wrapper contains information about the instances of that widget in windows.

The **class** of elements using this will by default be "toolbarbutton-1 chromeclass-toolbar-additional" and the value of the class property (when provided) will be added into that.

The **style** info will be added as inline style to all elements of that widget. The image will be loaded as centered background-image in toolbaritems and as list-style-image in toolbarbuttons.

The **callback** function will be stored in _ucUtils.sharedGlobal mapped to the provided id. Clicking the button will call the callback which will receive two arguments: **event** (click) and **window** which is a reference to the window object where that instance of the widget is.

If the callback property is not a function, then the widget will be just a passive element.

The **allEvents** property defines if the callback should be called for all clicks, not just left-clicks.

The **image** is loaded from `resources` folder so save your icon files there.


### _ucUtils.registerHotkey(details,function) -> Boolean

    // description for hotkey Ctrl + Shift + G
    let details = {
      id: "myHotkey",
      modifiers: "ctrl shift",
      key: "G"
    }
    
    function onHotkey(window,hotkey){
      console.log(hotkey);
      // prints id, modifiers and key of the pressed hotkey.
      // window is the window-object that captured this hotkey
    }
    
    let success = _ucUtils.registerHotkey(details,onHotkey);
 
Register a hotkey handler to each browser window. registerHotkey returns `true` if the hotkey was registered correctly. `false` if there was a problem. 
`id`,`modifiers` and `key` fields are mandatory and must be String type.

The function only supports modifiers `"alt"`, `"shift"`, `"ctrl"`, `"meta"` and `"accel"` modifiers.
Valid key values are `A-Z` `a-z` `-` and function keys `F1`-`F12`.

The created hotkey will override built-in hotkeys.

The id field in the details object should have some unique value, but this is not enforced.


### _ucUtils.getScriptdata() -> Array

    let scripts = _ucUtils.getScriptdata();
    for(let script of scripts){
      console.log(`${script.filename} - ${script.isRunning})
    }
 
Returns the currently loaded script files with their metadata

### _ucUtils.windows -> Object

Returns an object to interact with windows with two properties

#### _ucUtils.windows.get(onlyBrowsers) -> Array

Return a list of handles for each window for this firefox instance. If onlyBrowsers is false then this only includes browser windows (not consoles or similar). onlyBrowsers defaults to `true`.

#### _ucUtils.windows.forEach(function,onlyBrowsers)

    _ucUtils.windows.forEach((document,window) => console.log(document.location), false)

Runs the specified function for each window. The function will be given two arguments - reference to the document of the window and reference to the window object itself.

**Note!** `_ucUtils` may not be available on all target window objects if onlyBrowsers is `false`. The callback funcion should check for it's availability when called that way.

### _ucUtils.toggleScript(fileName or element)

filename:

    _ucUtils.toggleScript("test.uc.js")

Element where `this` is a menuitem:

    _ucUtils.toggleScript(this);

If the argument is an element the function reads a `filename` attribute from the element and uses that. Toggles the specified script, note that browser restart is required for changes to take effect.

### _ucUtils.loadURI(window,details) -> boolean

    _ucUtils.loadURI(window,{
      url:"about:config",
      where:"tab",        // one of ["current","tab","tabshifted","window"]
      private: true,      // should the window be private
      userContextId: 2    // numeric identifier for container
    });
    
    // "tabshifted" means background tab but it does not work for unknown reasons
    // Private tabs cannot be created in non-private windows

Return a boolean indicating if the operation was successful. "url" and "where" properties are mandatory - others are optional. 

### _ucUtils.restart(clearCache)

Immediately restart the browser. If the boolean clearCache is true then Firefox will invalidate startupCache which allows changes to the enabled scripts to take effect.

### _ucUtils.startupFinished() -> Promise

    _ucUtils.startupFinished()
    .then(()=>{
      console.log("startup done");
    });
    
Returns a promise that will be resolved when all windows have been restored during session startup. If all windows have already been restored at the time of calling the promise will be resolved immediately.

### _ucUtils.windowIsReady() -> Promise

    _ucUtils.windowIsReady(window)
    .then(()=>{
      console.log("this window has finished starting up");
    });

 This corresponds to `browser-delayed-startup-finished` event. Note that extension-engine initialization code may or may not have run when this promise resolves. 

### Difference of startupFinished and windowIsReady

Since scripts run per window, `startupFinished` will be resolved once in *each window that called it* when ALL those windows have been restored. But `windowIsReady` will be resolved whenever the particular window that calls it has started up.

## Prefs

A shortcut for reading and writing preferences

### _ucUtils.prefs.set(prefName,value) -> value

    _ucUtils.prefs.set("some.pref.path","test");
    _ucUtils.prefs.set("some.other.pref",300);

Returns a new value on success, undefined if pref couldn't be set

### _ucUtils.prefs.get(prefName) -> value

Returns the value of the pref, undefined if it doesn't exist

### _ucUtils.prefs.addListener(prefName,callback) -> Object

    let callback = (value,pref) => (console.log(`${pref} changed to ${value}`))
    let prefListener = _ucUtils.prefs.addListener("userChromeJS",callback);

Note that the callback will be invoked when any pref that starts with `userChromeJS` is changed. The pref in callback argument will be the actual pref whose value changed.

### _ucUtils.prefs.removeListener(listener)

    _ucUtils.prefs.removeListener(prefListener) // from above example

## Filesystem

Scripts should generally use the `resources` folder for their files. The helper functions interacting with filesystem expect `resources` to be the root folder for script operations.

The resources folder is registered to chrome:// scheme so scripts and stylesheets can use the following URL to access files within it:

    "chrome://userChrome/content/<filename>.txt" 

Scripts folder is registered to: `chrome://userScripts/content/`

The loader module folder is registered to `chrome://userchromejs/content/`

### _ucUtils.getFSEntry(fileName) -> fileHandle || enumerator for entries in a folder

Get file handle for resources/some.txt:

    let fileHandle = _ucUtils.getFSEntry("some.txt");

Loop through filesystem entries in resources/path:

    let contents = _ucUtils.getFSEntry("path");
    while(contents.hasMoreElements()){
      let nextFile = contents.getNext().QueryInterface(Ci.nsIFile);
      console.log(nextFile.leafName);
    }

### _ucUtils.readFile(fileHandle,metaOnly) -> String

    _ucUtils.readFile(aFile,false)

Attempts to read the content of the given fileHandle as text. Boolean metaOnly is used to parse only the metadata of userScripts when reading them from script directory.

### _ucUtils.createFileURI(fileName) -> String

    _ucUtils.createFileURI("path\some.png")

Return a valid file uri describing `<profileDir>\chrome\resources\path\some.png`

### _ucUtils.chromeDir

Return an object with two properties

    _ucUtils.chromeDir.uri // a file:/// uri
    
    _ucUtils.chromeDir.files -> enumerator for entries in chrome folder
    
    let entries = _ucUtils.chromeDir.files;
    while(entries.hasMoreElements()){
      let nextFile = entries.getNext().QueryInterface(Ci.nsIFile);
      console.log(nextFile.leafName);
    }

## Shared global object

If scripts need to store information to a global object they can get reference to that as follows:

    let global = _ucUtils.sharedGlobal

The information in the global object is available for all scripts

## Startup directive

Scripts can define a function to be executed when they are loaded in the header portion of the script. Consider the following header:

    // ==UserScript==
    // @name            My Test Script
    // @startup         myScriptObject
    
This tells the loader to execute a special function named `_startup` from `globalShared.myScriptObject`. The _startup function will receive one argument - reference to the window object where it was executed.

In short, to use startup directive you need to store an object named `myScriptObject` to the globalShared object and the myScriptObject must have a property called `_startup`.

    _ucUtils.sharedGlobal.myScriptObject = {
      _startup: function(win){ console.log(win.location) }
    }

**NOTE** This is behavior is completely incompatible with the way old userscripts implement startup - which generally was of form `eval(<whatever_is_in_header_startup>)`