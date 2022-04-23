# Yet another userChrome.js manager

The files in this repository create a toolkit to load arbitrary javascript files to be run in Firefox browser context. This method relies on autoconfig functionality available in Firefox.

# Overview

Files in `program` folder tell Firefox to load an additional javascript module file from the current Profile directory. The `boot.jsm` is the one that implements loading and managing additional files.

Since the files in `program` go to the main program installation path, they will affect all profiles that are being run using that executable.

However, the bulk of the logic is located in profile folder with `boot.jsm` so if the file is not found there then the loader is simply not used.

## Warning!

Please note that malicious external programs can now inject custom logic to Firefox even without elevated privileges just by modifying boot.jsm or adding their own scripts.

# Install

## Setting up config.js from "program" folder

Copy the *contents* of the directory called "program" (not the directory itself) into the directory of the Firefox binary you want it to apply to.

This means that if you want to affect multiple installations, like release, beta, ESR etc. you need to add the files to all of them.

<details>
<summary>Windows</summary>

Firefox is typically installed to `C:\Program Files\Mozilla Firefox\`

Copy `defaults/` and `config.js` there from the `program` folder. `config.js` should end up in the same directory where `firefox.exe` is.

</details>
<details>
<summary>Linux</summary>

Firefox is typically installed to `/usr/lib/firefox/` or `/usr/lib64/firefox/`

Copy `defaults/` and `config.js` there from the `program` folder. `config.js` should end up in the same directory where `firefox` binary is.

</details>
<details>
<summary>MacOS</summary>

Unknown. Someone with mac should test how it goes.

</details>

## Setting up profile

Copy the contents of the folder "profile" (not the folder itself) to the Firefox profile folder that you want to modify. If the profile already has a `chrome` folder (for userChrome.css or userContent.css) then the chrome folders should merge. Otherwise the chrome folder will be created.
You should end up with `chrome` folder in the profile root, and three folders inside it - JS, resources and utils.

There will be two files in the `chrome/utils/` folder:

* `chrome.manifest` - registers file paths to chrome:// protocol
* `boot.jsm` - implements user-script loading logic

## Deleting startup-cache

Firefox caches some files to speed-up startup. But the files in utils/ modify the startup behavior so you might be required to clear the startup-cache.

If you modify boot.jsm and happen to break it, you will likely need to clear startup-cache again.

<details>
<summary>Clear startup-cache via about:support (recommended)</summary>

0. Load `about:support`
0. In the top-right corner should be a button to clear the startup-cache.
0. Click that button and confirm the popup that will show up.
0. Firefox will restart with startup-cache cleared, and now the scripts should be working.
 
</details>
<details>
<summary>Clear startup-cache manually</summary>
The startup-cache folder can be found as follows:

0. load the following url `about:profiles`
0. locate the profile you wish to set up and click the "Open Folder" of the **Local** directory - this should open the directory in File Manager
0. Close Firefox
0. Delete folder "StartupCache"
0. Run Firefox

(Note) If you wish to set up a profile that doesn't use normal profile directories (i.e one that was lauched with command-line such as `firefox.exe -profile "C:\test\testprofile"` or with portable-apps launcher) then the startupCache folder will be in the profile root folder.
</details>

# Usage

The file extension for your custom scripts must be `.uc.js`, the loader script only looks for files with that extension.

Just put any such files into the `JS` directory. The `JS` directory should be in the same directory where userChrome.css would be. If you wish to change the directory name then you need to modify the `chrome.manifest` file inside `utils` directory. For example change `../JS/` to `../scripts/` to make Firefox load scripts from "scripts" folder.

At runtime, individual scripts can be toggled on/off from menubar -> tools -> userScripts. Note that toggling requires Firefox to be restarted, for which a "restart now" -button is provided. The button clears startup-cache so you don't need to worry about that.

A global preference to toggle all scripts is `userChromeJS.enabled`. This will disable all scripts but leaves the restart-button in the custom menu available.

# API

This manager is NOT entirely compatible with all existing userScripts - specifically scripts that expect a global _uc object or something similar to be available.

# Script scope

Each script normally runs once *per document* when the document is loaded. A window is a document, but a window may contain several "sub-documents" - kind of like iframes on web pages.

## @include & @exclude

By default, the loader executes your script only in the main browser window document. Using any @include header will override the default - for example:

```js
// ==UserScript==
// @include           chrome://browser/content/places/places.xhtml
// ==/UserScript==
```

The above would be executed only in the Library window.

```js
// ==UserScript==
// @include           main
// @include           chrome://browser/content/places/places.xhtml
// ==/UserScript==
```

This would execute in both library and main window. "main" is an alias for `chrome://browser/content/browser.xhtml`.

A wildcard `*` can be used to target any window.

```js
// ==UserScript==
// @include           *
// @exclude           main
// ==/UserScript==
```

This would execute in all documents, excecpt main window - notice "main" is excluded this time.

In addition, scripts can be marked as `@backgroundmodule` in which case they are executed "outside" of any document when the the loader reads the file. See **backgroundmodule** section below.

Some convenience functions are provided for scripts to use in global `_ucUtils` object available in windows.

## @onlyonce

By default the script is executed once per document it applies to, but this can be changed with `@onlyonce` header in which case the script will only be run in the first document.

```js
// ==UserScript==
// @name           example only-once file
// @onlyonce
// ==/UserScript==

console.log("Hello world!") // This is only run in the first window that opens.

```

## @backgroundmodule

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

## @ignorecache

This header can be used to mark scripts that should not be put into startup-cache. Instead, such scripts are always read from disk when loaded.

```js
// ==UserScript==
// @name           example ignorecache file
// @ignorecache
// ==/UserScript==

console.log("Hello world!")

```

This script would log "Hello world!" to console when new window is opened. Normally if you would change this script content and then open a new window, then Firefox would still log "Hello world!" because the script is cached. 

However, by ignoring cache the file is loaded from disk every time its used, thus changes will be reflected immediately (but not for the window the script has already been loaded into).

This header may be useful while developing a script, but you should leave caching enabled most of the time.

**Note:** if your script has already been cached once, then you need to clear startup-cache once to make it ignore cache. In other words, you can't add this header to existing script to make it ignore cache immediately.

## @loadOrder

```js
// ==UserScript==
// @name           example
// @loadOrder      3
// ==/UserScript==

console.log("This script is loaded sooner than default")
```

Load-order is treated as positive integer (including 0)
By default scripts have load-order `10`. Scripts with load-order <10 are injected before unmarked scripts and >10 are loaded after them.

If load-order is not specified then scripts follow normal filename alphabetical ordering.

Note: All Scripts marked as `backgroundmodule` will have load-order `-1`

## General

### _ucUtils.createElement(document,tagname,attributes,isHTML) -> Element

```js
_ucUtils.createElement(document,"menuitem",{ id:"someid", class:"aClass", label:"some label" })
```

Attaches a new element with tagname to the given document and adds it attributes from attributes object. isHTML is a boolean indicating whether the element is XUL element or HTML element - defaults to false.

### _ucUtils.createWidget(details) -> `<Widget wrapper object>` (or null on failure)

```js
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

```
Widget is a wrapper for actual elements. Firefox tracks widget placements *across windows* meaning that you can create the widget once and then you can re-position it using customize mode and its new location will be shared in all windows. The wrapper contains information about the instances of that widget in windows.

The **class** of elements using this will by default be "toolbarbutton-1 chromeclass-toolbar-additional" and the value of the class property (when provided) will be added into that.

The **style** info will be added as inline style to all elements of that widget. The image will be loaded as centered background-image in toolbaritems and as list-style-image in toolbarbuttons.

The **callback** function will be stored in _ucUtils.sharedGlobal mapped to the provided id. Clicking the button will call the callback which will receive two arguments: **event** (click) and **window** which is a reference to the window object where that instance of the widget is.

If the callback property is not a function, then the widget will be just a passive element.

The **allEvents** property defines if the callback should be called for all clicks, not just left-clicks.

The **image** is loaded from `resources` folder so save your icon files there.


### _ucUtils.registerHotkey(details,function) -> Boolean

```js
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

```

Register a hotkey handler to each browser window. registerHotkey returns `true` if the hotkey was registered correctly. `false` if there was a problem. 
`id`,`modifiers` and `key` fields are mandatory and must be String type.

The function only supports modifiers `"alt"`, `"shift"`, `"ctrl"`, `"meta"` and `"accel"` modifiers.
Valid key values are `A-Z` `a-z` `-` and function keys `F1`-`F12`.

The created hotkey will override built-in hotkeys.

The id field in the details object should have some unique value, but this is not enforced.


### _ucUtils.getScriptdata() -> Array

```js
let scripts = _ucUtils.getScriptdata();
for(let script of scripts){
  console.log(`${script.filename} - ${script.isRunning})
}
```

Returns the currently loaded script files with a copy of their metadata.

### _ucUtils.windows -> Object

Returns an object to interact with windows with two properties

#### _ucUtils.windows.get(onlyBrowsers) -> Array

Return a list of handles for each window object for this firefox instance. If `onlyBrowsers` is `true` then this only includes browser windows. If it's `false` then it also includes consoles, PiP, non-native notifications etc.

`onlyBrowsers` defaults to `true`.

#### _ucUtils.windows.forEach(function,onlyBrowsers)

```js
_ucUtils.windows.forEach((document,window) => console.log(document.location), false)
```

Runs the specified function for each window. The function will be given two arguments - reference to the document of the window and reference to the window object itself.

**Note!** `_ucUtils` may not be available on all target window objects if onlyBrowsers is `false`. The callback function should check for it's availability when called that way.

### _ucUtils.toggleScript(fileName or element) -> Object or null

filename:

```js
_ucUtils.toggleScript("test.uc.js")
```

Element where `this` is a menuitem:

```js
_ucUtils.toggleScript(this);
```

If the argument is an element the function reads a `filename` attribute from the element and uses that. Toggles the specified script, note that browser restart is required for changes to take effect.

The return value is `null` if a matching script was not found. Otherwise, the return value is an object `{ script: filename, enabled: true|false }`

### _ucUtils.loadURI(window,details) -> boolean

```js
_ucUtils.loadURI(window,{
  url:"about:config",
  where:"tab",        // one of ["current","tab","tabshifted","window"]
  private: true,      // should the window be private
  userContextId: 2    // numeric identifier for container
});

// "tabshifted" means background tab but it does not work for unknown reasons
// Private tabs cannot be created in non-private windows
```

Return a boolean indicating if the operation was successful. "url" and "where" properties are mandatory - others are optional. 

### _ucUtils.restart(clearCache)

Immediately restart the browser. If the boolean clearCache is true then Firefox will invalidate startupCache which allows changes to the enabled scripts to take effect.

### _ucUtils.startupFinished() -> Promise

```js
_ucUtils.startupFinished()
.then(()=>{
  console.log("startup done");
});
```

Returns a promise that will be resolved when all windows have been restored during session startup. If all windows have already been restored at the time of calling the promise will be resolved immediately.

### _ucUtils.windowIsReady() -> Promise

```js
_ucUtils.windowIsReady(window)
.then(()=>{
  console.log("this window has finished starting up");
});
```

 This corresponds to `browser-delayed-startup-finished` event. Note that extension-engine initialization code may or may not have run when this promise resolves. 

### Difference of startupFinished and windowIsReady

Since scripts run per window, `startupFinished` will be resolved once in *each window that called it* when ALL those windows have been restored. But `windowIsReady` will be resolved whenever the particular window that calls it has started up.

### _ucUtils.showNotification(details) -> Promise

```js
_ucUtils.showNotification(
  {
    label : "Message content",  // text shown in the notification
    type : "something",         // opt identifier for this notification
    priority: "info",           // opt one of ["system","critical","warning","info"]
    window: window.top          // opt reference to a chromeWindow
    tab: gBrowser.selectedTab,  // opt reference to a tab
    buttons: [...]              // opt array of button descriptors
    callback: () => {}          // opt function to be called when notification is dismissed
  }
)
```
Priority defines the ordering and coloring of this notification. Notifications of higher priority are shown before those of lower priority. Priority defaults to "info".

If `window` key exists then the notification will be shown in that window. Otherwise it is shown in the last active window.

If `tab` key exists then the notification will be shown in that tab only. Otherwise the notification is global to the window.

See more about `buttons` and `callback` keys at [notificationbox.js](https://searchfox.org/mozilla-central/rev/3f782c2587124923a37c750b88c5a40108077057/toolkit/content/widgets/notificationbox.js#113)

## Prefs

A shortcut for reading and writing preferences

### _ucUtils.prefs.set(prefName,value) -> value

```js
_ucUtils.prefs.set("some.pref.path","test");
_ucUtils.prefs.set("some.other.pref",300);
```

Returns a new value on success, undefined if pref couldn't be set

### _ucUtils.prefs.get(prefName) -> value

Returns the value of the pref, undefined if it doesn't exist

### _ucUtils.prefs.addListener(prefName,callback) -> Object

```js
let callback = (value,pref) => (console.log(`${pref} changed to ${value}`))
let prefListener = _ucUtils.prefs.addListener("userChromeJS",callback);
```

Note that the callback will be invoked when any pref that starts with `userChromeJS` is changed. The pref in callback argument will be the actual pref whose value changed.

### _ucUtils.prefs.removeListener(listener)

```
_ucUtils.prefs.removeListener(prefListener) // from above example
```

## Filesystem

Scripts should generally use the `resources` folder for their files. The helper functions interacting with filesystem expect `resources` to be the root folder for script operations.

The resources folder is registered to chrome:// scheme so scripts and stylesheets can use the following URL to access files within it:

    "chrome://userChrome/content/<filename>.txt" 

Scripts folder is registered to: `chrome://userScripts/content/`

The loader module folder is registered to `chrome://userchromejs/content/`

### _ucUtils.getFSEntry(fileName) -> fileHandle || enumerator for entries in a folder

Get file handle for resources/some.txt:

```js
let fileHandle = _ucUtils.getFSEntry("some.txt");
```

Loop through filesystem entries in resources/path:

```js
let contents = _ucUtils.getFSEntry("path");
while(contents.hasMoreElements()){
  let nextFile = contents.getNext().QueryInterface(Ci.nsIFile);
  console.log(nextFile.leafName);
}
```

### _ucUtils.readFile(fileHandle,metaOnly) -> String

```js
_ucUtils.readFile(aFile,false)
```

Attempts to read the content of the given fileHandle as text. Boolean metaOnly is used to parse only the metadata of userScripts when reading them from script directory.

### _ucUtils.createFileURI(fileName) -> String

```js
_ucUtils.createFileURI("path\some.png")
```

Return a valid file uri describing `<profileDir>\chrome\resources\path\some.png`

### _ucUtils.chromeDir

Returns an object with two properties

```js
_ucUtils.chromeDir.uri // a file:/// uri

_ucUtils.chromeDir.files -> enumerator for entries in chrome folder

let entries = _ucUtils.chromeDir.files;
while(entries.hasMoreElements()){
  let nextFile = entries.getNext().QueryInterface(Ci.nsIFile);
  console.log(nextFile.leafName);
}
```

## Shared global object

If scripts need to store information to a global object they can get reference to that as follows:

```js
let global = _ucUtils.sharedGlobal
```

The information in the global object is available for all scripts

## Startup directive

Scripts can define a function to be executed when they are loaded in the header portion of the script. Consider the following header:

    // ==UserScript==
    // @name            My Test Script
    // @startup         myScriptObject
    
This tells the loader to execute a special function named `_startup` from `globalShared.myScriptObject`. The _startup function will receive one argument - reference to the window object where it was executed.

In short, to use startup directive you need to store an object named `myScriptObject` to the globalShared object and the myScriptObject must have a property called `_startup`.

```js
_ucUtils.sharedGlobal.myScriptObject = {
  _startup: function(win){ console.log(win.location) }
}
```

**NOTE** This is behavior is completely incompatible with the way old userscripts implement startup - which generally was of form `eval(<whatever_is_in_header_startup>)`
