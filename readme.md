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

Firefox is typically installed to `/Applications/Firefox.app/Contents/MacOS/` or `/Applications/Firefox Nightly.app/Contents/MacOS/`

Copy `defaults/` and `config.js` to `/Applications/Firefox.app/Contents/Resources/` from the `program` folder. `config.js` should end up in the `/Applications/Firefox.app/Contents/Resources/` directory.

</details>

## Setting up profile

Copy the contents of the folder "profile" (not the folder itself) to the Firefox profile folder that you want to modify. If the profile already has a `chrome` folder (for userChrome.css or userContent.css) then the chrome folders should merge. Otherwise the chrome folder will be created.
You should end up with `chrome` folder in the profile root, and three folders inside it - JS, resources and utils.

There will be three files in the `chrome/utils/` folder:

* `chrome.manifest` - registers file paths to chrome:// protocol
* `boot.jsm` - implements user-script loading logic
* `fs.jsm` - implements filesystem-related functions - `boot.jsm` uses this file internally.

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

The file extension for your custom scripts must be `.uc.js` or `.sys.mjs` (for backgroundmodule only), the loader script only looks for files with those extensions.

Just put any such files into the `JS` directory. The `JS` directory should be in the same directory where userChrome.css would be. If you wish to change the directory name then you need to modify the `chrome.manifest` file inside `utils` directory. For example change `../JS/` to `../scripts/` to make Firefox load scripts from "scripts" folder.

At runtime, individual scripts can be toggled on/off from menubar -> tools -> userScripts. Note that toggling requires Firefox to be restarted, for which a "restart now" -button is provided. The button clears startup-cache so you don't need to worry about that.

A global preference to toggle all scripts is `userChromeJS.enabled`. This will disable all scripts but leaves the restart-button in the custom menu available.

# API

This manager is NOT entirely compatible with all existing userScripts - specifically scripts that expect a global `_uc` object or something similar to be available. This manager does export a `_ucUtils` object to window objects though.

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

Alternatively, you can name your script with `.sys.mjs` file extension in which case the loader automatically treats it as backgroundmodule.

Note that the `EXPORTED_SYMBOLS` array like above in module global scope is mandatory in `.uc.js` scripts.

### ES6 modules

```js
// ==UserScript==
// @name           example sys.mjs module
// ==/UserScript==

import { Some } from "chrome://userscripts/content/modules/some.sys.mjs";
// This would import the script from "modules" sub-directory of your scripts folder.
// Note that such script would not be loaded by boot.jsm itself.

Some.doThing();
...
```

The manager loads any `.sys.mjs` files always as backgroundmodule - in addition they are loaded as ES6 modules which means you can use static `import` and `export` declarations inside them.

You should note that background modules do not have access to window objects when they are being run because they are executed before any window exists. Thus, they also do not get access to `_ucUtils` object.

## @description

The `@description` header can be used to store short description in script meta-data.

```js
// ==UserScript==
// @description    simple test script that does nothing
// ==/UserScript==
```

### @long-description

Normally `@description` stores the text appearing on the same line as the header itself. However, when `@long-description` is present the description will be a block comment starting from the next line after the `@description` header:

```js
// ==UserScript==
// @long-description
// @description    this-part-is-now-ignored
/*
Here goes my long description about this mighty powerful script.
It does all the things and even more!
...
or at least that's the plan, it actually does nothing currently :p
*/
// ==/UserScript==
```

Note that the single-line part of `@description` is now ignored. But you can put something there as fallback value for loaders that don't have multi-line description support.

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

## @onlyonce

By default the script is executed once per document it applies to, but this can be changed with `@onlyonce` header in which case the script will only be run in the first document.

```js
// ==UserScript==
// @name           example only-once file
// @onlyonce
// ==/UserScript==

console.log("Hello world!") // This is only run in the first window that opens.

```

## General

### \_ucUtils.createElement(document,tagname,attributes,isHTML) -> Element

```js
_ucUtils.createElement(document,"menuitem",{ id:"someid", class:"aClass", label:"some label" })
```

Attaches a new element with tagname to the given document and adds it attributes from attributes object. isHTML is a boolean indicating whether the element is XUL element or HTML element - defaults to false.

### \_ucUtils.createWidget(details) -> `<Widget wrapper object>`

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

This method will throw if:

* `id` is not provided
* `type` is anything except `"toolbaritem"` or `"toolbarbutton"`
* A widget with same id already exists. For example if a script which calls this method is executed in multiple Firefox windows then the first one should succeed, but successive calls should throw an Error.

### \_ucUtils.registerHotkey(details,function) -> Boolean

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


### \_ucUtils.getScriptdata(aFilter) -> Array | ScriptInfo

Returns `ScriptInfo` object(s) with a **copy** of their metadata. This includes scripts that are not yet running or which are disabled by pref.

When called without arguments returns an array of `ScriptInfo` objects describing your scripts.

```js
let scripts = _ucUtils.getScriptdata(); 
for(let script of scripts){
  console.log(`${script.filename} - @{script.isEnabled} - ${script.isRunning}`)
}
```

If the first argument is a `string` then this returns **a single** `ScriptInfo` object for a script that had the specified filename. If such script is not found then `null` is returned.

```js
let script = _ucUtils.getScriptdata("my-script.uc.js");
console.log(`@{script.name} - ${script.isRunning}`);
```

If the first argument is a function, then this function returns a filtered list of scripts that return `true` when the function is run on them:

```js
let scripts = _ucUtils.getScriptdata(s => s.isRunning);
console.log(`You have ${scripts.length} running scripts);
// This is essentially the same as _ucUtils.getScriptdata().filter(s => s.isRunning)
```

**Note!** If the first argument is anything other than a function or a string, then `getScriptData()` will throw an error.

### \_ucUtils.parseStringAsScriptInfo(aName, aString) -> ScriptInfo

This can be used to construct a `ScriptInfo` object from arbitrary string following the same logic the loader uses internally. When given `aName` as "filename" the `aString` is parsed just like script metadata block in your files.

```js
let myMetadataBlock = `// ==UserScript==
// @name           my-test-info
// @description    Constructed ScriptInfo
// ==/UserScript==
`;

let scriptInfo = _ucUtils.parseStringAsScriptInfo("fakeFileName",myMetadataBlock);
console.log(scriptInfo.name)
// "my-test-info"
```

**Note!** There needs to be a new-line after the closing `// ==/UserScript==` "tag" for the metadata to be parsed correctly.

### \_ucUtils.windows -> Object

Returns an object to interact with windows with two properties

#### \_ucUtils.windows.get(onlyBrowsers) -> Array

Return a list of handles for each window object for this firefox instance. If `onlyBrowsers` is `true` then this only includes browser windows. If it's `false` then it also includes consoles, PiP, non-native notifications etc.

`onlyBrowsers` defaults to `true`.

#### \_ucUtils.windows.forEach(function,onlyBrowsers)

```js
_ucUtils.windows.forEach((document,window) => console.log(document.location), false)
```

Runs the specified function for each window. The function will be given two arguments - reference to the document of the window and reference to the window object itself.

**Note!** `_ucUtils` may not be available on all target window objects if onlyBrowsers is `false`. The callback function should check for it's availability when called that way.

### \_ucUtils.toggleScript(fileName or element) -> Object or null

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

### \_ucUtils.loadURI(window,details) -> boolean

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

### \_ucUtils.restart(clearCache)

Immediately restart the browser. If the boolean `clearCache` is `true` then Firefox will invalidate startupCache which allows changes to the enabled scripts to take effect.

### \_ucUtils.startupFinished() -> Promise

```js
_ucUtils.startupFinished()
.then(()=>{
  console.log("startup done");
});
```

Returns a promise that will be resolved when all windows have been restored during session startup. If all windows have already been restored at the time of calling the promise will be resolved immediately.

### \_ucUtils.windowIsReady() -> Promise

```js
_ucUtils.windowIsReady(window)
.then(()=>{
  console.log("this window has finished starting up");
});
```

 This corresponds to `browser-delayed-startup-finished` event. Note that extension-engine initialization code may or may not have run when this promise resolves. 

### Difference of startupFinished and windowIsReady

Since scripts run per window, `startupFinished` will be resolved once in *each window that called it* when ALL those windows have been restored. But `windowIsReady` will be resolved whenever the particular window that calls it has started up.

### \_ucUtils.showNotification(details) -> Promise

```js
_ucUtils.showNotification(
  {
    label : "Message content",  // text shown in the notification
    type : "something",         // opt identifier for this notification
    priority: "info",           // opt one of ["system","critical","warning","info"]
    window: window.top ,        // opt reference to a chromeWindow
    tab: gBrowser.selectedTab,  // opt reference to a tab
    buttons: [...],             // opt array of button descriptors
    callback: () => {}          // opt function to be called when notification is dismissed
  }
)
```
Priority defines the ordering and coloring of this notification. Notifications of higher priority are shown before those of lower priority. Priority defaults to "info".

If `window` key exists then the notification will be shown in that window. Otherwise it is shown in the last active window.

If `tab` key exists then the notification will be shown in that tab only. Otherwise the notification is global to the window.

See more about `buttons` and `callback` keys at [notificationbox.js](https://searchfox.org/mozilla-central/rev/3f782c2587124923a37c750b88c5a40108077057/toolkit/content/widgets/notificationbox.js#113)

### \_ucUtils.updateStyleSheet(name, sheet_mode) -> boolean

```js
_ucUtils.updateStyleSheet() // reloads userChrome.css

 // reloads a style in author-mode stylesheets list with matching name
_ucUtils.updateStyleSheet("userChrome.au.css","author")

 // reloads a style in agent-mode stylesheets list with matching name
_ucUtils.updateStyleSheet("userChrome.ag.css","agent")
```

Argument `filename` is relative to `resources` folder, but you can use `../` prefix to get back to `chrome` folder.

Note, you can't reload a style that is in one sheet-mode list into another sheet-mode. Such as, you cannot use this to reload userChrome.css into agent-mode list.

Return value true/false indicates wheter a style file with specified name was found in the corresponding list.

If the specified stylesheet imports other files, then calling this will also reload any of those imported files. However, in experience it might be that reload of imported stylesheets does not take effect until a new window is created.

## Prefs

A shortcut for reading and writing preferences

### \_ucUtils.prefs.set(prefName,value) -> value

```js
_ucUtils.prefs.set("some.pref.path","test");
_ucUtils.prefs.set("some.other.pref",300);
```

Returns a new value on success, undefined if pref couldn't be set

### \_ucUtils.prefs.get(prefName) -> value

Returns the value of the pref, undefined if it doesn't exist

### \_ucUtils.prefs.addListener(prefName,callback) -> Object

```js
let callback = (value,pref) => (console.log(`${pref} changed to ${value}`))
let prefListener = _ucUtils.prefs.addListener("userChromeJS",callback);
```

Note that the callback will be invoked when any pref that starts with `userChromeJS` is changed. The pref in callback argument will be the actual pref whose value changed.

### \_ucUtils.prefs.removeListener(listener)

```
_ucUtils.prefs.removeListener(prefListener) // from above example
```

## Filesystem general

Scripts should generally use the `resources` folder for their files. The helper functions interacting with filesystem expect `resources` to be the root folder for script operations.

The resources folder is registered to chrome:// scheme so scripts and stylesheets can use the following URL to access files within it:

```
"chrome://userChrome/content/<filename>.txt" 
```

Scripts folder is registered to: `chrome://userScripts/content/`

The loader module folder is registered to `chrome://userchromejs/content/`

### \_ucUtils.openScriptDir() -> Boolean

```js
_ucUtils.openScriptDir();
```

Tries to open your script directory in OS file manager. Returns true or false indicating success. Whether this works or not probably depends on your OS. Only tested on Windows 10.

## Filesystem \_ucUtils.fs

These APIs exist starting from versioned release "0.7".

Main idea is that various methods return a `FileSystemResult` object instead of the actual operation result directly.

The `FileSystemResult` result object is one of four types:
* `Filesystem.RESULT_FILE` get reference to a file
* `Filesystem.RESULT_DIRECTORY` get referece to a directory
* `Filesystem.RESULT_ERROR` non-existent file or other kind of error
* `Filesystem.RESULT_CONTENT` file read operation results

The result object has various methods to access underlying data.

```js
// return nsIFile object representing either a file a directory
// throws if called on CONTENT or ERROR types
fsResult.entry()

// return the file text content as string
// throws if called on anything except CONTENT type
fsResult.content() // returns content that was read 

// return an iterator over files in a directory
// Note, the individual entries are nsIFile objects, not wrapped `FileSystemResult`s
// throws when called on anything except DIRECTORY type
fsResult.entries()
// entries() is called internally if you try to iterate over the result:
fsResult = _ucUtils.getEntry("my_dir");
for(let file of fsResult){
  ...
}

// size of read content or size of the file on disk
fsResult.size

// Read the content of this FileSystemResult
// throws if called on non-FILE type
let content = await fsResult.read() // Async read
console.log(content);
<< "Hello world!"

// throws if called on non-FILE type
let sync_content = fsResult.readSync();
console.log(content);
<< "Hello world!"

// get a file URI for this result
console.log(fsResult.fileURI)
<< file:///c:/temp/things/some.txt

// Tries to open a given file entry path in OS file manager.
// Returns true or false indicating success.
// Whether this works or not probably depends on your OS.
// Only tested on Windows 10.
fsResult.showInFileManager()

```

### \_ucUtils.fs.getEntry(fileName) -> FileSystemResult

```js
let fsResult = _ucUtils.fs.getEntry("some.txt");
result.isFile()
// true

let nonexistent = _ucUtils.fs.getEntry("nonexistent.txt");
nonexistent.isError()
// true

let dir = _ucUtils.fs.getEntry("directory");
dir.isDirectory()
// true
```

### \_ucUtils.fs.readFile(fileName) -> Promise\<FileSystemResult\>

Asynchronously read a file. Throws if the argument is not a string

```js
let fsResult = await _ucUtils.fs.readFile("some.txt");
fsResult.isFile()
// false
fsResult.isContent()
// true
console.log(fsResult.content())
// "Hello world!"
```

### \_ucUtils.fs.readFileSync(some) -> FileSystemResult

Synchronously read a file. The argument can be either a string representing filename or referece to a nsIFile object.

```js
let fsResult = _ucUtils.fs.readFileSync("some.txt");
fsResult.isContent()
// true
console.log(fsResult.content())
// "Hello world!"
```

### \_ucUtils.fs.readJSON(fileName) -> Promise\<Object | null\>

Asynchronously try to read a file and parse it as json. If file can't be parsed then returns `null`.

```js
let fsResult = await _ucUtils.fs.readJSON("some.json")
```

### \_ucUtils.fs.writeFile(fileName, content, options) -> Promise\<Number\>

```js
let some_content = "Hello world!\n";
let bytes = await _ucUtils.fs.writeFile( "hello.txt", some_content );
console.log(bytes);

<< 13
```

Write the content into file **as UTF8**. On successful write the promise is resolved with number of written bytes.

By default writing files using this API is only allowed in **resources** directory. Calling `writeFile` with fileName like "../test.txt" will then reject the promise. You must set pref `userChromeJS.allowUnsafeWrites` to `true` to allow writing outside of resources.

**Note!** Currently this method **replaces** the existing file if one exists.

The optional `options` argument is currently only used to pass a filename for temp file. By default it is derived from fileName. 

### \_ucUtils.fs.chromeDir() -> FileSystemResult

Returns `FileSystemResult` with type DIRECTORY for the profile `chrome` directory

```js
let fsResult = _ucUtils.fs.chromeDir();
let uri = _ucUtils.chromeDir.fileURI // a file:/// uri

for (let file of fsResult){ // equal to fsResult.entries()
  console.log(file.leafName);
}
```

## Filesystem methods (deprecated, don't use)

**Attention!** Don't use these anymore. First versioned build `"0.7"` introduced a new `_ucUtils.fs` API that you should use instead. These old methods will be removed in `"0.8"` which will be released with Firefox ESR 115

### \_ucUtils.getFSEntry(fileName) -> nsIFile || enumerator for entries in a folder

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

By default `getFSEntry()` returns an enumerator over files when the argument matches a folder. If you want to return an nsIFile object describing the folder itself then supply optional argument disabling automatic enumeration.

```js
let directory = _ucUtils.getFSEntry("path", false);
console.log(directory.leafName)
```

### \_ucUtils.readFile(\<nsIFile or string\>,metaOnly) -> String

```js
_ucUtils.readFile(aFile,false)
```

```js
let content = _ucUtils.readFile("test.txt")

>> console.log(content)
<< "some file content"
```

Attempts to read the content of the given fileHandle as text. Boolean metaOnly is used to parse only the metadata of userScripts when reading them from script directory.

When first argument is a string, the filename is parsed as being relative to the **resources** directory.

### \_ucUtils.readFileAsync(fileName) -> Promise \<filecontent\>

```js

// read from resources directory

_ucUtils.readFileAsync("test.txt")
.then(content => console.log(content))

<< "some file content"

// read from parent directory of resources:

_ucUtils.readFileAsync("../userChrome.css")
.then(content => console.log(content))

<< "#nav-bar{ background: #f00 !important }"
```

Asynchronous file reading. Filename must be a string corresponding to a file relative to **resources** directory. Promise is rejected if file isn't found.

### \_ucUtils.readJSON(fileName) -> Promise \<Object\>

```js
_ucUtils.readJSON("some.json")
.then(some => console.log(some))

<< Object { test: "Hello world!", value: 42 }
```

A wrapper for `_ucUtils.readFileAsync` which tries to parse the file contents as JSON.

### \_ucUtils.writeFile( fileName, content, \[options\] ) -> Promise \<Number\>

```js
let some_content = "Hello world!\n";
let bytes = await _ucUtils.writeFile( "hello.txt", some_content );
console.log(bytes);

<< 13
```

Write the content into file **as UTF8**. On successful write the promise is resolved with number of written bytes.

By default writing files using this API is only allowed in **resources** directory. Calling `writeFile` with fileName like "../test.txt" will then reject the promise. You must set pref `userChromeJS.allowUnsafeWrites` to `true` to allow writing outside of resources.

**Note!** Currently this method **replaces** the existing file if one exists.

The optional `options` argument is currently only used to pass a filename for temp file. By default it is derived from fileName. 

### \_ucUtils.createFileURI(fileName) -> String

```js
_ucUtils.createFileURI("path\some.png")
```

Return a valid file uri describing `<profileDir>\chrome\resources\path\some.png`

### \_ucUtils.chromeDir

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

# Startup Error

Did you experience broken Firefox startup with message banner:

```js
"fx-autoconfig: Startup is broken"
```

Did it provide you with a button to "Enable workaround"? And after restart you got another banner message:

```js
"fx-autoconfig: Something was broken in last startup"
```

Clicking the button sent you here, right? So what is going on here?
Fear not! Here's what's happening... probably.

In older versions of this loader script, boot.jsm had a hack to make a Firefox internal `gBrowser` object available for your custom scripts. However, said hack is now disabled by default in latest versions of boot.jsm.

So, if boot.jsm detects that startup has been broken because gBrowser is not available, it will show said banner. Clicking the "Enable workaround"-button will tell boot.jsm to set a pref `userChromeJS.gBrowser_hack.enabled` to `true` on next startup. You can always set that pref manually if you wish.

Note: there's is also related pref `userChromeJS.gBrowser_hack.required` which boot.jsm uses to tell itself that startup was broken on last run.

## What causes this error?

Somewhere in your custom scripts you are using `gBrowser` object which is not necessarily available at the time you are executing your script. Do note however, that you don't have to be using gBrowser directly in your script, it may happen as a side-effect of accessing some other internal object.

One notable example is if you try to access `gURLBar` - that will internally end up accessing gBrowser - which does not exist and that will break startup.

## What can you do to not rely on gBrowser?

Think about when your script needs to run and you have some options:

* Wait until windows have been restored before running functions that access gBrowser. One method for that would be: `_ucUtils.startupFinished().then(myFunctionAccessinggBrowser)`

* Check in your function whether `gBrowser` is available, and if not use `_gBrowser` instead.

* Apply the original hack that was done by boot.jsm:

```js
if(window._gBrowser){
  window.gBrowser = window._gBrowser;
}
```

Note that the second option does not work if gBrowser is accessed as a side-effect of using something else. For example, if you accessed `gURLBar`, then you might be able to (depending what you try to do) instead get reference to urlbar element and use that:

```js
  gURLBar.someproperty // old
  document.getElementById("urlbar").someproperty // replacement
```

Or you can simply set `userChromeJS.gBrowser_hack.enabled` to `true`

# Tests

Very WIP

There are few simplistic tests inside the `test_profile` directory. To run them you need to launch Firefox with command-line arguments pointing Firefox to use the `test_profile` folder as a non-relative profile. That would go for example like this:

```
firefox -profile "C:/things/fx-autoconfig/test_profile"
```

Test results should be printed to browser console.
