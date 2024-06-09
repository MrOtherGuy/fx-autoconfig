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

**Note:** Any keys in the `details` object that are not mentioned above are added to the created element as attributes.

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

> Deprecated in 0.9.0 - use [_ucUtils.hotkeys.define()](#_ucutilshotkeysdefinedetails---Hotkey) instead

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

### \_ucUtils.hotkeys.define(details) -> Hotkey

> New in 0.9.0

```js
// description for hotkey Ctrl + Shift + G
let details = {
  id: "myHotkey",
  modifiers: "ctrl shift",
  key: "G",
  command: (window,commandEvent) => console.log("Hello from " + window.document.title);
}

let myKey = _ucUtils.hotkeys.define(details);
// myKey will be a instance of Hotkey description object 
```

If `command` is a function then a new `<command>` element will be created for it with an `id` attribute derived from the specified id. If `command` is a string then the hotkey will simply invoke a command matching that string - either a built-in command name or an id of the to-be-invoked <command>. 

`hotkeys.define()` simply creates a definition for the hotkey, but it does not add it to any window. The Hotkey instance will have methods you can use to do that:

```
{
  trigger: Object - description for to-be-generated <key> element
  command: Object - description for to-be-generated <command> element
  matchingSelector: string 
  attachToWindow(window,opt) - creates a <key> and <command> elements to specified window
  autoAttach(opt) - adds hotkey to all current (main) windows as well as all newly created ones
  suppressOriginalKey(window) - Disables the original `<key>` for this hotkey
  restoreOriginalKey(window) - Re-enables the original `<key>` if it was disabled 
}
```

The optional `opt` object on `attachToWindow(_,opt)` and `autoAttach(opt)` is a simple dictionary which can be used to run suppressOriginalKey() automatically:

*Note:* `attachToWindow()` is asynchronous method - this is so that we don't add the elements to DOM during window creation, but only after it is ready.

```js

let details = {
  id: "myHotkey",
  modifiers: "ctrl",
  key: "T",
  command: (window,commandEvent) => console.log("Hello from " + window.document.title);
}

_ucUtils.hotkeys.define(details).autoAttach({suppressOriginalKey: true});
// This defines the key `Ctrl+T`, attaches it to all current and future main browser windows and disables original newtab key.

```


### \_ucUtils.getScriptData(aFilter) -> Array | ScriptInfo

Returns `ScriptInfo` object(s) with a **copy** of their metadata. This includes scripts that are not yet running or which are disabled by pref.

When called without arguments returns an array of `ScriptInfo` objects describing your scripts.

```js
let scripts = _ucUtils.getScriptData(); 
for(let script of scripts){
  console.log(`${script.filename} - @{script.isEnabled} - ${script.isRunning}`)
}
```

If the first argument is a `string` then this returns **a single** `ScriptInfo` object for a script that had the specified filename. If such script is not found then `null` is returned.

```js
let script = _ucUtils.getScriptData("my-script.uc.js");
console.log(`@{script.name} - ${script.isRunning}`);
```

If the first argument is a function, then this function returns a filtered list of scripts that return `true` when the function is run on them:

```js
let scripts = _ucUtils.getScriptData(s => s.isRunning);
console.log(`You have ${scripts.length} running scripts);
// This is essentially the same as _ucUtils.getScriptData().filter(s => s.isRunning)
```

**Note!** If the first argument is anything other than a function or a string, then `getScriptData()` will throw an error.

### \_ucUtils.getStyleData(aFilter) -> Array | ScriptInfo

Mechanically exactly the same as `getScriptData()` but returns styles instead of scripts.

### \_ucUtils.parseStringAsScriptInfo(aName, aString, parseAsStyle) -> ScriptInfo

This can be used to construct a `ScriptInfo` object from arbitrary string following the same logic the loader uses internally. When given `aName` as "filename" the `aString` is parsed just like script metadata block in your files. optional `parseAsStyle` argument, when truthy, makes the method parse `aString` as style instead of a script.

```js
let myMetadataBlock = `// ==UserScript==
// @name           my-test-info
// @description    Constructed ScriptInfo
// ==/UserScript==
`;

let scriptInfo = _ucUtils.parseStringAsScriptInfo("fakeFileName", myMetadataBlock);
console.log(scriptInfo.name, scriptInfo.chromeURI);
// "my-test-info chrome://userscripts/content/fakeFileName"

let styleInfo = _ucUtils.parseStringAsScriptInfo("fakeFileName", myMetadataBlock, true);
console.log(styleInfo.name, styleInfo.chromeURI);
// "my-test-info chrome://userstyles/skin/fakeFileName"

```

**Note!** There needs to be a new-line after the closing `// ==/UserScript==` "tag" for the metadata to be parsed correctly.

### \_ucUtils.windows -> Object

Returns an object to interact with windows

#### \_ucUtils.windows.getAll(onlyBrowsers) -> Array

> Renamed from .get() to .getAll() in 0.9.0

Return a list of handles for each window object for this firefox instance. If `onlyBrowsers` is `true` then this only includes browser windows. If it's `false` then it also includes consoles, PiP, non-native notifications etc.

`onlyBrowsers` defaults to `true`.

#### \_ucUtils.windows.forEach(function,onlyBrowsers)

```js
_ucUtils.windows.forEach((document,window) => console.log(document.location), false)
```

Runs the specified function for each window. The function will be given two arguments - reference to the document of the window and reference to the window object itself.

**Note!** `_ucUtils` may not be available on all target window objects if onlyBrowsers is `false`. The callback function should check for it's availability when called that way.

#### \_ucUtils.windows.getLastFocused(?windowType) -> Window

> New in 0.9.0

Returns the last focused window. If windowType is undefined then returns `"navigator:browser"` window (eg. main browser window) on Firefox or `"mail:3pane"` window on Thunderbird.

#### \_ucUtils.windows.isBrowserWindow(window) -> Bool

> New in 0.9.0

Returns `true`/`false` indicating if the argument window is a main browser window.

#### \_ucUtils.windows.waitWindowLoading(window) -> Promise<Window>

> New in 0.9.0

Returns a `Promise` which resolves when it has finished its initialization work. Scripts are normally injected on `DOMContentLoaded` event, but lots of initialization has not happened yet.

```js
_ucUtils.windows.waitWindowLoading(window)
.then(win => {
  console.log(win.document.title + " has finished loading")
})
```

#### \_ucUtils.windows.onCreated(callback)

> New in 0.9.0

Registers the `callback` function to be called when a new window has been opened. The callback is executed on `DOMContentLoaded` event. Perhaps not useful for normal scripts, but can be an easy way for a background-script to do work when window is created:

```js
// ==UserScript==
// @name           background module script
// @description    my filename is background.sys.mjs
// ==/UserScript==

import { windowUtils, Hotkey } from "chrome://userchromejs/content/utils/utils.sys.mjs";

let counter = 0;

windowUtils.onCreated(win => {
  counter++
});

Hotkey.define({
  id: "myHotkey",
  modifiers: "ctrl shift",
  key: "F",
  command: () => console.log("Windows opened until now:", counter)
}).autoAttach()

``` 


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

> Deprecated since 0.9.0 - use [windows.waitWindowLoading()](#_ucutilswindowswaitwindowloadingwindow---promisewindow) 

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

### \_ucUtils.prefs.set(prefName,value) -> undefined

```js
_ucUtils.prefs.set("some.pref.path","test");
_ucUtils.prefs.set("some.other.pref",300);
```

This will `throw` if you try to set a pref to a value of different type than what it currently is (ie. boolean vs. string) unless the pref doesn't exist when this is called.
This will also throw if you try to set the pref with value that is not one of `number, string, boolean` - number is also converted to integer.

### \_ucUtils.prefs.get(prefName) -> Pref

Returns a representation of the pref wrapped into an object with properties:

```js
let myPref = _ucUtils.prefs.get("userChrome.scripts.disabled");
/*
* {
*   exists() // true|false indicating if this pref exists
*   name     // string - the called pref name
*   value    // <number|string|boolean> | `null` - null means pref with this name could not be read
* set value() // same as _ucUtils.prefs.set(name,value)
*   hasUserValue() // true|false indicating if this has user set value
*   type     // "string"|"boolean"|"number"|"invalid"
*   reset()  // resets this pref to its default value
* }
*/

myPref.exists()
// false - "userChrome.scripts.disabled" does not exist
```


### \_ucUtils.prefs.addListener(prefName,callback) -> Object

```js
let callback = (value,pref) => (console.log(`${pref} changed to ${value}`))
let prefListener = _ucUtils.prefs.addListener("userChromeJS",callback);
```

Note that the callback will be invoked when any pref that starts with `userChromeJS` is changed. The pref in callback argument will be a `Pref` object wrapping the value of the actual pref whose value was changed.

### \_ucUtils.prefs.removeListener(listener)

```
_ucUtils.prefs.removeListener(prefListener) // from above example
```

Pref class can also be imported directly to module scripts like this:

```js
import { Pref } from "chrome://userchromejs/content/utils.sys.mjs";
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

## Shared global object

If scripts need to store information to a global object they can get reference to that as follows:

```js
let global = _ucUtils.sharedGlobal
```

The information in the global object is available for all scripts