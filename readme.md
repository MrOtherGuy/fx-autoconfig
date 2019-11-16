# Yet another userChrome.js manager

The files in this repository create a toolkit to load arbitrary javascript files to be run in Firefox browser context.

# Overview

Files in `program` folder tell Firefox to load an additional javascript module file from the current Profile directory. The boot.jsm is the one tha implements loading and managing additional files.

Since the files in `program` go to the main program installation path, they will affect all profiles that are being run using that executable.

However, the bulk of the logic is located in profile folder with boot.jsm so if boot.jsm is not found there then the loader is simply not used.

## Warning!

Please note that malicious external programs can now inject custom logic to Firefox even without elevated privileges just by modifying boot.jsm or adding their own scripts.

# Install

## Setting up program

Copy the *contents* of the folder "program" (not the folder itself) to the program folder you want the changes to apply to.
That means the config.js should end up to the same folder where firefox.exe is located

### Note for Release and Beta versions

Firefox will ignore the config.js file in release and beta versions. You will need either Developer Edition or Nightly. Only some functions in config.js are permitted in Release and Beta but the Components object that we require is not available.

## Setting up profile

Copy the contents of the folder "profile" (not the folder itself) to the Firefox profile folder that you want to modify. If the profile already has a `chrome` folder (for userChrome.css or userContent.css) then the chrome folders should merge. Otherwise the chrome folder will be created.
You should end up with `chrome` folder in the profile root, and three folders inside it - JS, resources and utils.

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

Just put any such files in the scripts folder inside chrome folder, same folder where userChrome.css would be. By default the scripts folder is named `JS` but this is customizable by modifying boot.jsm.

At runtime, individual scripts can be toggled on/off from menubar -> tools -> userScripts. Note that toggling requires Firefox to be restarted, for which a restart now -button is provided.

A global preference to toggle all scripts is `userChromeJS.enabled`. This will disable all scripts but leaves the restart-button in the custom menu available.

# API

This manager is NOT entirely compatible with all existing userScripts - specifically scripts that expect a global _uc object or something similar to be available.

Some convenience functions are provided for scripts to use in global `_ucUtils` object.

## General

### _ucUtils.createElement(document,tagname,attributes) -> xulElement

    _ucUtils.createElement(document,"menuitem",{ id:"someid", class:"aClass", label:"some label" })

Attaches a new XUL element with tagname to the given document and adds it attributes from attributes object.

### _ucUtils.getScriptdata() -> Array

    let scripts = _ucUtils.getScriptdata();
    for(let script of scripts){
      console.log(`${script.filename} - ${script.isRunning})
    }
 
Returns the currently loaded script files with their metadata

### _ucUtils.getWindows(onlyBrowsers) -> Array

    _ucUtils.getWindows(true)

Return a list of handles for each window for this firefox.exe. If onlyBrowsers is false then this only includes browser windows (not consoles or similar)

### _ucUtils.toggleScript(fileName or element)

filename:

    _ucUtils.toggleScript("test.uc.js")

Element where `this` is a menuitem:

    _ucUtils.toggleScript(this);

If the argument is an element the function reads a `filename` attribute from the element and uses that. Toggles the specified script, note that browser restart is required for changes to take effect.

### _ucUtils.restart(clearCache)

Immediately restart the browser. If the boolean clearCache is true then Firefox will invalidate startupCache which allows changes to the enabled scripts to take effect.

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