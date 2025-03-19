# Yet another userChrome.js manager

The files in this repository create a toolkit to load arbitrary javascript files to be run in Firefox browser context. This method relies on autoconfig functionality available in Firefox.

# Overview

Files in `program` folder tell Firefox to load an additional javascript module file from the current Profile directory. The `boot.sys.mjs` is the one that implements loading and managing additional files.

Since the files in `program` go to the main program installation path, they will affect all profiles that are being run using that executable.

However, the bulk of the logic is located in profile folder with `boot.sys.mjs` so if the file is not found there then the loader is simply not used.

The loader module (`boot.sys.mjs`) depends on two additional files: `utils.sys.mjs` to which is collection of various helper functions you can use in your scripts and `fs.sys.mjs` to implement read and write operations on the file system. Version "0.10.0" also added new `uc_api.sys.mjs` file which as an interface that scripts should import instead of importing utils.sys.mjs directly.

**Note** as of version "0.8" fx-autoconfig is incompatible with Firefox ESR 102

**Note** version "0.10.0" deprecated old `_ucUtils` symbol in favor of new `UC_API` so expect breakage if upgrading from older versions.

## Warning!

Please note that malicious external programs can now inject custom logic to Firefox even without elevated privileges just by modifying boot.sys.mjs or adding their own script files.

# Install

## Setting up config.js from "program" folder

Copy the *contents* of the directory called "program" (not the directory itself) into the directory of the Firefox binary you want it to apply to.

This means that if you want to affect multiple installations, like release, beta, ESR etc. you need to add the files to all of them.

**! Note for non-regular Firefox installs:** Compatibility issues will arise if your Firefox install is already using autoconfiguration files (such as Librefox). In these  situations the easiest route might be to merge the *contents* of `config.js` with the autoconfiguration file your install has. This may or may not require you to also set prefs from `<program>/defaults/pref/config-prefs.js` with the excetion of `general.config.filename`.

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
<details>
<summary>Nix</summary>

  NixOS:
  
```nix
programs.firefox = {
  enable = true;
  autoConfig = builtins.readFile(builtins.fetchurl {  
    url = "https://raw.githubusercontent.com/MrOtherGuy/fx-autoconfig/master/program/config.js";
    sha256 = "1mx679fbc4d9x4bnqajqx5a95y1lfasvf90pbqkh9sm3ch945p40";
  });
};
```

Home Manager:

```nix
home.packages = with pkgs; [
  (firefox.override {
    extraPrefsFiles = [(builtins.fetchurl {  
      url = "https://raw.githubusercontent.com/MrOtherGuy/fx-autoconfig/master/program/config.js";
      sha256 = "1mx679fbc4d9x4bnqajqx5a95y1lfasvf90pbqkh9sm3ch945p40";
    })];
  })
];
```

</details>

## Setting up profile

Copy the contents of the folder "profile" (not the folder itself) to the Firefox profile folder that you want to modify. If the profile already has a `chrome` folder (for userChrome.css or userContent.css) then the chrome folders should merge. Otherwise the chrome folder will be created.
You should end up with `chrome` folder in the profile root, and three folders inside it - JS, resources and utils.

There will be four files in the `chrome/utils/` folder:

* `chrome.manifest` - registers file paths to chrome:// protocol
* `boot.sys.mjs` - implements user-script loading logic
* `fs.jsm` - implements filesystem-related functions - `boot.sys.mjs` uses this file internally.
* `utils.sys.mjs` - implements various functions used by `utils.sys.mjs` and which your scripts can also use
* (new in 0.10.0) `uc_api.sys.mjs` - helper API, making importing methods from `utils.sys.mjs` easier 

## Deleting startup-cache

Firefox caches some files to speed-up startup. But the files in utils/ modify the startup behavior so you might be required to clear the startup-cache.

If you modify boot.sys.mjs and happen to break it, you will likely need to clear startup-cache again.

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

The loader module `boot.sys.mjs` looks for three kinds of files in your scripts directory ("JS" by default - can be changed in `chrome.manifest`):

* `<filename>.uc.js` - classic script which will be synchronously injected into target documents.
* `<filename>.uc.mjs` (new in 0.8) - script which will be loaded into target documents asynchronously as ES6 module.
* `<filename>.sys.mjs` - module script which will be loaded into global context synchronously once on startup

Additionally (".uc.js") scripts can be marked as background-module by tagging them with `@backgroundmodule` in the script header. `(Deprecated in 0.10.0)`

Just put any such files into the `JS` directory. The `JS` directory should be in the same directory where userChrome.css would be. If you wish to change the directory name then you need to modify the `chrome.manifest` file inside `utils` directory. For example change `../JS/` to `../scripts/` to make Firefox load scripts from "scripts" folder.

At runtime, individual scripts can be toggled on/off from menubar -> tools -> userScripts. Note that toggling requires Firefox to be restarted, for which a "restart now" -button is provided. The button clears startup-cache so you don't need to worry about that.

For window scoped scripts (classic `.uc.js` and `.uc.mjs`) it the toggling should take effect when a new window is opened. Any effects in the old window will persist though.

A global preference to toggle all scripts is `userChromeJS.enabled`. This will disable all scripts but leaves the restart-button in the custom menu available.

## Styles

From version `0.8.5` onwards the loader also supports injection of styles. The default directory where loader looks for them is `chrome/CSS/` which again can be re-mapped by modifying `chrome/utils/chrome.manifest`

File name of styles must end with `.uc.css` which the loader will pick up automatically - just like scripts. By default, scripts are injected in *author* mode only into browser.xhtml - you can register other targets using the header @include directives just like scripts.

Alternatively you can use `@stylemode      agent_sheet` directive in header to make loader register it as agent style. User styles are not supported currently - just use userChrome.css for that.

Notice that the header format for styles is slightly different than it is for scripts because CSS doesn't support `//` line comments.

## Filenames

Script files (among other things) are loaded using `chrome://` protocol. Chrome urls are of form:

```
chrome://<package>/<provider>/<path>

eg.

chrome://userscripts/content/my_script.uc.js
```

Notable for the `path` part, it must *start* with `[a-zA-Z0-9]` and as such the loader module only tries to seek script files where the filename starts with alphanumeric character. Note that files in sub-directories *can* still start with some other character.

Same limitation also applies to all other uses of `chrome://` urls, such as if you try to load some file from your `resources`
directory using chrome url.

[See more about chrome url canonification at searchfox](https://searchfox.org/mozilla-central/rev/3c7b40d1d74c26a82486f38b5828c3f3a43e05da/chrome/nsChromeRegistry.cpp#175)

# API

This manager is NOT entirely compatible with all existing userScripts - specifically scripts that expect a global `_uc` object or something similar to be available. This manager does export a `_ucUtils` object to window objects which is described in [api definition section](#uc_api).

Additionally, version `0.10.0` is very much incompatible with earlier versions, because `_ucUtils` is replaced with `UC_API`.

## Script scope

Each script normally runs once *per document* when the document is loaded. A window is a document, but a window may contain several "sub-documents" - kind of like iframes on web pages, an example of this is the sidebar.

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

This would execute in both library and main window. `main` is an alias for `chrome://browser/content/browser.xhtml` in Firefox and `chrome://messenger/content/messenger.xhtml` in Thunderbird

A wildcard `*` can be used to target any window.

```js
// ==UserScript==
// @include           *
// @exclude           main
// ==/UserScript==
```

This would execute in all documents, excecpt main window - notice "main" is excluded this time.

In addition, scripts can be marked as `@backgroundmodule` in which case they are executed "outside" of any document when the the loader reads the file. See [backgroundmodule](#backgroundmodule) section below.

Some convenience functions are provided for scripts to use in global `_ucUtils` object available in windows.

## @backgroundmodule

> (Deprecated in 0.10.0) - use ES6 modules (.sys.mjs files) instead.

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

Note that the `EXPORTED_SYMBOLS` array like above in module global scope is mandatory in `.uc.js` scripts when they are loaded as backgroundmodule. It is not necessary in `.sys.mjs` scripts.

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

You should note that background modules do not have access to window objects when they are being run because they are executed before any window exists. Thus, they also do not automatically get access to `_ucUtils` or `UC_API` objects.

As of version `0.8` ES6 module scripts, including backgroundmodules (so `.sys.mjs` and `.uc.mjs` files) can import `UC_API` like this:

```js
import * from "chrome://userchromejs/content/uc_api.sys.mjs";
```
Although window scoped module scripts (.uc.mjs) automatically gain access to it anyway from the window object.

### import heads-up

(This section only applies to pre 0.10.0 versions and somewhat if you try to import utils.sys.mjs directly)

**Note for .uc.mjs scripts!**
Because your script is running in its own module scope within a window the module imported with an `import` statement above is NOT the same instance of the object as what you would get automatically via `_ucUtils`. The methods within are the same, but since it is a different object its internal properties have not been initialized by `boot.sys.mjs` so some functionality is missing - such as access to custom script info via `.getScriptData()`

You can instead use ChromeUtils to import the same object from the global object:

```js
const { _ucUtils } = ChromeUtils.importESModule("chrome://userchromejs/content/utils.sys.mjs")
```

Or indeed just use `_ucUtils` from the window object.

The same behavior applies to all modules imported from .uc.mjs module scopes via `import` statements.


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

## @startup

> (Deprecated in 0.10.0) - use [Windows.onCreated](#windowsoncreated-callback-) instead

Scripts can define a function to be executed when they are loaded in the header portion of the script. Consider the following header:

    // ==UserScript==
    // @name            My Test Script
    // @onlyonce
    // @startup         myScriptObject
    
This tells the loader to execute this script file only once per session because of `@onlyonce` directive. But the header also tells the loader to execute a special function named `_startup` from `sharedGlobal.myScriptObject` on *each* window. This makes it possible to do some global initialization work once and then run only the `_startup` function for each window created afterwards.

The _startup function will receive one argument - reference to the window object where it was executed.

In short, to use startup directive you need to store an object named `myScriptObject` to the sharedGlobal object and the myScriptObject must have a property called `_startup`.

```js
_ucUtils.sharedGlobal.myScriptObject = {
  _startup: function(win){ console.log(win.location) }
}
```

**NOTE** This is behavior is completely incompatible with the way old userscripts implement startup - which generally was of form `eval(<whatever_is_in_header_startup>)`

## @stylemode (styles only)

Default value is `author_sheet` - valid values are `author_sheet` and `agent_sheet`

```js
/* ==UserScript==
// @name           agent style sheet
// @description    an example for @stylemode directive
// @stylemode      agent_sheet
// ==/UserScript== */
```

Tells the loader in which mode this style should be injected. Agent sheets are global, author sheets are per document you inject them into (default browser.xhtml)

## @usefileuri (styles only)

Tells the loader to register this style using its `file:///` url instead of `chrome://` url. 

/* ==UserScript==
// @name           author style sheet
// @usefileuri 
// ==/UserScript== */

Note that some CSS features may not be available for file:// uri styles. However, chrome:// styles cannot be modified using devtools, while file:// uri styles can be.

# UC\_API

For pre 0.10.0 definitions you can check separate file available at [uc_utils_old.md](./uc_utils_old.md).

TypeScript types are also available as a private npm package in the [types](./types) directory. To use them with `chrome://` imports - put the following in your tsconfig.json:
```json
{
  "compilerOptions": {
    "paths": {
      "chrome://userchromejs/content/uc_api.sys.mjs": [
        "./node_modules/@types/fx-autoconfig/index.d.ts"
      ]
    }
  }
}
```

Helpers are available as a namespace object - the whole namespace can be imported to module scripts as follows:

```js
import * as UC_API from "chrome://userchromejs/content/uc_api.sys.mjs";
```
The same namespace is also defined on window objects as `UC_API` symbol that can be used in window scoped scripts.

Or you can import individual namespaces like this:

```js
import { FileSystem } from "chrome://userchromejs/content/uc_api.sys.mjs";
```

Helpers divided into separate namespaces:

* [UC_API.FileSystem](#filesystem)
* [UC_API.Hotkeys](#hotkeys)
* [UC_API.Notifications](#notifications)
* [UC_API.Prefs](#prefs)
* [UC_API.Runtime](#runtime)
* [UC_API.Scripts](#scripts)
* [UC_API.SharedStorage](#sharedstorage)
* [UC_API.Utils](#utils)
* [UC_API.Windows](#windows)

## Filesystem

Scripts should generally use the `resources` folder for their files. The helper functions interacting with filesystem expect `resources` to be the root folder for script operations.

The resources folder is registered to chrome:// scheme so scripts and stylesheets can use the following URL to access files within it:

```
"chrome://userChrome/content/<filename>.txt" 
```

Scripts folder is registered to: `chrome://userScripts/content/`

The loader module folder is registered to `chrome://userchromejs/content/`

Main idea is that various methods of the FileSystem namespace return a `FileSystemResult` object instead of the actual operation result directly.

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
fsResult = FileSystem.getEntry("my_dir");
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

### FileSystem.getEntry(fileName) -> `FileSystemResult`

```js
let fsResult = UC_API.FileSystem.getEntry("some.txt");
result.isFile()
// true

let nonexistent = UC_API.FileSystem.getEntry("nonexistent.txt");
nonexistent.isError()
// true

let dir = UC_API.FileSystem.getEntry("directory");
dir.isDirectory()
// true
```

### FileSystem.readFile(fileName) -> `Promise<FileSystemResult>`

Asynchronously read a file. Throws if the argument is not a string

```js
let fsResult = await UC_API.FileSystem.readFile("some.txt");
fsResult.isFile()
// false
fsResult.isContent()
// true
console.log(fsResult.content())
// "Hello world!"
```

### FileSystem.readFileSync(some) -> `FileSystemResult`

Synchronously read a file. The argument can be either a string representing filename or referece to a nsIFile object.

```js
let fsResult = UC_API.FileSystem.readFileSync("some.txt");
fsResult.isContent()
// true
console.log(fsResult.content())
// "Hello world!"
```

### FileSystem.readJSON(fileName) -> `Promise<Object | null>`

Asynchronously try to read a file and parse it as json. If file can't be parsed then returns `null`.

```js
let fsResult = await UC_API.FileSystem.readJSON("some.json")
```

### FileSystem.writeFile(fileName, content, options) -> `Promise<Number>`

```js
let some_content = "Hello world!\n";
let bytes = await UC_API.FileSystem.writeFile( "hello.txt", some_content );
console.log(bytes);

<< 13
```

Write the content into file **as UTF8**. On successful write the promise is resolved with number of written bytes.

By default writing files using this API is only allowed in **resources** directory. Calling `writeFile` with fileName like "../test.txt" will then reject the promise. You must set pref `userChromeJS.allowUnsafeWrites` to `true` to allow writing outside of resources.

**Note!** Currently this method **replaces** the existing file if one exists.

The optional `options` argument is currently only used to pass a filename for temp file. By default it is derived from fileName. 

### FileSystem.chromeDir() -> `FileSystemResult`

Returns `FileSystemResult` with type DIRECTORY for the profile `chrome` directory

```js
let fsResult = UC_API.FileSystem.chromeDir();
let uri = fsResult.fileURI // a file:/// uri

for (let file of fsResult){ // equal to fsResult.entries()
  console.log(file.leafName);
}
```

## Hotkeys

### Hotkeys.define(details) -> `Hotkey`

```js
// description for hotkey Ctrl + Shift + G
let details = {
  id: "myHotkey",
  modifiers: "ctrl shift",
  key: "G",
  command: (window,commandEvent) => console.log("Hello from " + window.document.title);
}

let myKey = UC_API.Hotkeys.define(details);
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

UC_API.Hotkeys.define(details).autoAttach({suppressOriginal: true});
// This defines the key `Ctrl+T`, attaches it to all current and future main browser windows and disables original newtab key.

```

## Notifications

Display and receive input to and from browser notification toolbar (not to be confused with OS notification system)

### UC_API.Notifications.show(details) -> `Promise`

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

## Prefs

A shortcut for reading and writing preferences

### Prefs.set(prefName,value) -> `undefined`

```js
UC_API.Prefs.set("some.pref.path","test");
UC_API.Prefs.set("some.other.pref",300);
```

This will `throw` if you try to set a pref to a value of different type than what it currently is (ie. boolean vs. string) unless the pref doesn't exist when this is called.
This will also throw if you try to set the pref with value that is not one of `number, string, boolean` - number is also converted to integer.

### Prefs.get(prefName) -> `Pref`

Returns a representation of the pref wrapped into an object with properties:

```js
let myPref = UC_API.Prefs.get("userChrome.scripts.disabled");
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


### Prefs.addListener(prefName,callback) -> `Object`

```js
let callback = (value,pref) => (console.log(`${pref} changed to ${value}`))
let prefListener = UC_API.Prefs.addListener("userChromeJS",callback);
```

Note that the callback will be invoked when any pref that starts with `userChromeJS` is changed. The pref in callback argument will be a `Pref` object wrapping the value of the actual pref whose value was changed.

### Prefs.removeListener(listener)

```
UC_API.Prefs.removeListener(prefListener) // from above example
```

Pref class can also be imported directly to module scripts like this:

```js
import { Pref } from "chrome://userchromejs/content/utils.sys.mjs";
```

## Runtime

Provides general information about the loader and state of the browser.

### Runtime.appVariant -> `String`
One of "Firefox" or "Thunderbird"

### Runtime.brandName -> `String`
Brand name of the browser eg. "Firefox", "Firefox Nightly" etc.

### Runtime.config -> `null`
Perhaps to be used in the future

### Runtime.loaderVersion -> `String`
The version string of `boot.sys.mjs` 

### Runtime.restart(clearCache)

Immediately restart the browser. If the boolean `clearCache` is `true` then Firefox will invalidate startupCache which allows changes to the enabled scripts to take effect. A closing prompt is shown if some other part of the browser such as a website would need a confirmation about restart.

### Runtime.startupFinished() -> `Promise<>`

```js
UC_API.Runtime.startupFinished()
.then(()=>{
  console.log("startup done");
});
```

Returns a promise that will be resolved when all windows have been restored during session startup. If all windows have already been restored at the time of calling the promise will be resolved immediately.

## Scripts
Provide information about registered scripts and styles and some controls for them.

### Scripts.getScriptData(aFilter) -> `Array<ScriptInfo>` | `ScriptInfo`

Returns `ScriptInfo` object(s) with a **copy** of their metadata. This includes scripts that are not yet running or which are disabled by pref.

When called without arguments returns an array of `ScriptInfo` objects describing your scripts.

```js
let scripts = UC_API.Scripts.getScriptData(); 
for(let script of scripts){
  console.log(`${script.filename} - @{script.isEnabled} - ${script.isRunning}`)
}
```

If the first argument is a `string` then this returns **a single** `ScriptInfo` object for a script that had the specified filename. If such script is not found then `null` is returned.

```js
let script = UC_API.Scripts.getScriptData("my-script.uc.js");
console.log(`@{script.name} - ${script.isRunning}`);
```

If the first argument is a function, then this function returns a filtered list of scripts that return `true` when the function is run on them:

```js
let scripts = UC_API.Scripts.getScriptData(s => s.isRunning);
console.log(`You have ${scripts.length} running scripts);
// This is essentially the same as UC_API.Scripts.getScriptData().filter(s => s.isRunning)
```

**Note!** If the first argument is anything other than a function or a string, then `getScriptData()` will throw an error.

### Scripts.getStyleData(aFilter) -> `Array<ScriptInfo>` | `ScriptInfo`

Mechanically exactly the same as `getScriptData()` but returns styles instead of scripts.

### Scripts.getScriptMenuForDocument() -> `Element`
Returns the `<menu>` element created for controlling scripts. In Firefox this is inside Menubar > Tools.

**Note!** The menu is lazily generated and calling this method should cause it to be generated if it isn't already.

### Scripts.openScriptDir -> `Boolean`

```js
UC_API.Scripts.openScriptDir();
```

Tries to open your script directory in OS file manager. Returns true or false indicating success. Whether this works or not probably depends on your OS. Only tested on Windows 10.

### Scripts.openStyleDir -> `Boolean`

```js
UC_API.Scripts.openStyleDir();
```

Tries to open your style directory in OS file manager. Returns true or false indicating success. Whether this works or not probably depends on your OS. Only tested on Windows 10.

### Scripts.parseStringAsScriptInfo(aName, aString, parseAsStyle) -> `ScriptInfo`

This can be used to construct a `ScriptInfo` object from arbitrary string following the same logic the loader uses internally. When given `aName` as "filename" the `aString` is parsed just like script metadata block in your files. optional `parseAsStyle` argument, when truthy, makes the method parse `aString` as style instead of a script.

```js
let myMetadataBlock = `// ==UserScript==
// @name           my-test-info
// @description    Constructed ScriptInfo
// ==/UserScript==
`;

let scriptInfo = UC_API.Scripts.parseStringAsScriptInfo("fakeFileName", myMetadataBlock);
console.log(scriptInfo.name, scriptInfo.chromeURI);
// "my-test-info chrome://userscripts/content/fakeFileName"

let styleInfo = UC_API.Scripts.parseStringAsScriptInfo("fakeFileName", myMetadataBlock, true);
console.log(styleInfo.name, styleInfo.chromeURI);
// "my-test-info chrome://userstyles/skin/fakeFileName"

```

**Note!** There needs to be a new-line after the closing `// ==/UserScript==` "tag" for the metadata to be parsed correctly.

### Scripts.toggleScript(fileName) -> Object | null

```js
UC_API.Scripts.toggleScript("test.uc.js")
```

Toggles the specified script, note that browser restart is required for changes to take effect.

The return value is `null` if a matching script was not found. Otherwise, the return value is an object `{ script: filename, enabled: true|false }`

### Scripts.reloadStyleSheet(name, sheet_mode) -> `Boolean`

```js
UC_API.Scripts.reloadStyleSheet() // reloads userChrome.css

 // reloads a style in author-mode stylesheets list with matching name
UC_API.Scripts.reloadStyleSheet("userChrome.au.css","author")

 // reloads a style in agent-mode stylesheets list with matching name
UC_API.Scripts.reloadStyleSheet("userChrome.ag.css","agent")
```

Argument `filename` is relative to `resources` folder, but you can use `../` prefix to get back to `chrome` folder.

Note, you can't reload a style that is in one sheet-mode list into another sheet-mode. Such as, you cannot use this to reload userChrome.css into agent-mode list.

Return value true/false indicates wheter a style file with specified name was found in the corresponding list.

If the specified stylesheet imports other files, then calling this will also reload any of those imported files. However, in experience it might be that reload of imported stylesheets does not take effect until a new window is created.

## Utils
Few DOM manipulation helpers for creating elements etc.

### Utils.createElement(document,tagname,attributes,isHTML) -> `Element`

```js
UC_API.Utils.createElement(document,"menuitem",{ id:"someid", class:"aClass", label:"some label" })
```

Attaches a new element with tagname to the given document and adds it attributes from attributes object. isHTML is a boolean indicating whether the element is XUL element or HTML element - defaults to false.

### UC_API.Utils.createWidget(details) -> `<Widget wrapper object>`

```js
UC_API.Utils.createWidget({
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

### Utils.escapeXUL(string) -> `String`
Escapes xul markup in case you need to add strings to the UI

### Utils.loadURI(window,details) -> boolean

```js
UC_API.Utils.loadURI(window,{
  url:"about:config",
  where:"tab",        // one of ["current","tab","tabshifted","window"]
  private: true,      // should the window be private
  userContextId: 2    // numeric identifier for container
});

// "tabshifted" means background tab but it does not work for unknown reasons
// Private tabs cannot be created in non-private windows
```

Return a boolean indicating if the operation was successful. "url" and "where" properties are mandatory - others are optional. 

## SharedStorage
If scripts need to store information to a global object they can get reference to that as follows:

```js
let global = UC_API.SharedStorage
```

Note that data stored here is only available in memory and does not persist on disk.

## Windows

Namespace to interact with windows.

### Windows.getAll(onlyBrowsers) -> `Array`

Return a list of handles for each window object for this firefox instance. If `onlyBrowsers` is `true` then this only includes browser windows. If it's `false` then it also includes consoles, PiP, non-native notifications etc.

```js
let allMyWindows = UC_API.Windows.getAll(false)
```

`onlyBrowsers` defaults to `true`.

### UC_API.Windows.forEach(function,onlyBrowsers)

```js
UC_API.Windows.forEach((document,window) => console.log(document.location), false)
```

Runs the specified function for each window. The function will be given two arguments - reference to the document of the window and reference to the window object itself.

**Note!** `UC_API` may not be available on all target window objects if onlyBrowsers is `false`. The callback function should check for it's availability when called that way.

### Windows.getLastFocused(?windowType) -> `Window`

Returns the last focused window. If windowType is undefined then returns `"navigator:browser"` window (eg. main browser window) on Firefox or `"mail:3pane"` window on Thunderbird.

### Windows.isBrowserWindow(window) -> `Boolean`

Returns `true`/`false` indicating if the argument window is a main browser window.

### Windows.onCreated(callback)

Registers the `callback` function to be called when a new window has been opened. The callback is executed on `DOMContentLoaded` event. Perhaps not useful for normal scripts, but can be an easy way for a background-script to do work when window is created.

**Note!** This also works as replacement in version `0.10.0` for now deprecated `@startup` directive.

```js
// ==UserScript==
// @name           initialization script
// @description    my filename is background.uc.mjs
// @onlyonce
// ==/UserScript==

import { Windows, Hotkeys } from "chrome://userchromejs/content/uc_api.sys.mjs";

let counter = 0;

Hotkeys.define({
  id: "myHotkey",
  modifiers: "ctrl shift",
  key: "F",
  command: () => console.log("Windows opened until now:", counter)
}).autoAttach(); // autoAttach causes this hotkey to be added to all new windows

Windows.onCreated(win => {
  counter++
});

``` 
Since the above script is marked as `@onlyonce` it is only injected into the first browser window to do initialization work (registering the hotkey). But the `Windows.onCreated` callback gets called whenever a new window is created so the counter get updated.

### Windows.waitWindowLoading(window) -> Promise<Window>

Returns a `Promise` which resolves when it has finished its initialization work. Scripts are normally injected on `DOMContentLoaded` event, but lots of initialization has not happened yet.

```js
UC_API.Windows.waitWindowLoading(window)
.then(win => {
  console.log(win.document.title + " has finished loading")
})
```

### Difference of `Runtime.startupFinished()` and `Windows.waitWindowLoading()`

Since scripts run per window, `startupFinished` will be resolved once in *each window that called it* when ALL those windows have been restored. But `waitWindowLoading` will be resolved whenever the particular window that calls it has started up.

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

In older versions of this loader script, boot.sys.mjs had a hack to make a Firefox internal `gBrowser` object available for your custom scripts. However, said hack is now disabled by default in latest versions of boot.sys.mjs.

So, if boot.sys.mjs detects that startup has been broken because gBrowser is not available, it will show said banner. Clicking the "Enable workaround"-button will tell boot.sys.mjs to set a pref `userChromeJS.gBrowser_hack.enabled` to `true` on next startup. You can always set that pref manually if you wish.

Note: there's is also related pref `userChromeJS.gBrowser_hack.required` which boot.sys.mjs uses to tell itself that startup was broken on last run. Neiter the `.required` or `.enabled` pref might not exist if the loader has not detected broken startup.

If you later want to disable the "gBrowser hack" then you need to set **both** `userChromeJS.gBrowser_hack.enabled` and `userChromeJS.gBrowser_hack.required` to false - or simply removing both prefs.

## What causes this error?

Somewhere in your custom scripts you are using `gBrowser` object which is not necessarily available at the time you are executing your script. Do note however, that you don't have to be using gBrowser directly in your script, it may happen as a side-effect of accessing some other internal object.

One notable example is if you try to access `gURLBar` - that will internally end up accessing gBrowser - which does not exist and that will break startup.

## What can you do to not rely on gBrowser?

Think about when your script needs to run and you have some options:

* Wait until windows have been restored before running functions that access gBrowser. One method for that would be: `UC_API`.Runtime.startupFinished().then(myFunctionAccessinggBrowser)`

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
