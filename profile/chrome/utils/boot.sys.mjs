import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";
import { FileSystem as FS } from "chrome://userchromejs/content/fs.sys.mjs";
import { _ucUtils as utils, ScriptInfo, loaderModuleLink, YPref } from "chrome://userchromejs/content/utils.sys.mjs";

const FX_AUTOCONFIG_VERSION = "0.8";
console.warn( "Browser is executing custom scripts via autoconfig" );

const SHARED_GLOBAL = {};
Object.defineProperty(SHARED_GLOBAL,"widgetCallbacks",{value:new Map()});

const APP_VARIANT = (() => {
  let is_tb = AppConstants.BROWSER_CHROME_URL.startsWith("chrome://messenger");
  return {
    THUNDERBIRD: is_tb,
    FIREFOX: !is_tb
  }
})();

const BROWSERCHROME = (() => {
  if(APP_VARIANT.FIREFOX){
    return AppConstants.BROWSER_CHROME_URL
  }
  return "chrome://messenger/content/messenger.xhtml"
})();

const PREF_ENABLED = 'userChromeJS.enabled';
const PREF_SCRIPTSDISABLED = 'userChromeJS.scriptsDisabled';
const PREF_GBROWSERHACKENABLED = 'userChromeJS.gBrowser_hack.enabled';

function getDisabledScripts(){
  return Services.prefs.getStringPref(PREF_SCRIPTSDISABLED,"").split(",")
}

class ScriptData {
  #preCompiledESM;
  #preCompileFailed;
  #preCompiling;
  constructor(leafName, headerText, noExec){
    const hasLongDescription = (/^\/\/\ @long-description/im).test(headerText);
    this.filename = leafName;
    this.name = headerText.match(/\/\/ @name\s+(.+)\s*$/im)?.[1];
    this.charset = headerText.match(/\/\/ @charset\s+(.+)\s*$/im)?.[1];
    this.description = hasLongDescription
      ? headerText.match(/\/\/ @description\s+.*?\/\*\s*(.+?)\s*\*\//is)?.[1]
      : headerText.match(/\/\/ @description\s+(.+)\s*$/im)?.[1];
    this.version = headerText.match(/\/\/ @version\s+(.+)\s*$/im)?.[1];
    this.author = headerText.match(/\/\/ @author\s+(.+)\s*$/im)?.[1];
    this.icon = headerText.match(/\/\/ @icon\s+(.+)\s*$/im)?.[1];
    this.homepageURL = headerText.match(/\/\/ @homepageURL\s+(.+)\s*$/im)?.[1];
    this.downloadURL = headerText.match(/\/\/ @downloadURL\s+(.+)\s*$/im)?.[1];
    this.updateURL = headerText.match(/\/\/ @updateURL\s+(.+)\s*$/im)?.[1];
    this.optionsURL = headerText.match(/\/\/ @optionsURL\s+(.+)\s*$/im)?.[1];
    this.startup = headerText.match(/\/\/ @startup\s+(.+)\s*$/im)?.[1];
    this.id = headerText.match(/\/\/ @id\s+(.+)\s*$/im)?.[1]
           || `${leafName.split('.uc.js')[0]}@${this.author||'userChromeJS'}`;
    this.isESM = this.filename.endsWith(".mjs");
    this.onlyonce = /\/\/ @onlyonce\b/.test(headerText);
    this.inbackground = this.filename.endsWith(".sys.mjs") || /\/\/ @backgroundmodule\b/.test(headerText);
    this.ignoreCache = /\/\/ @ignorecache\b/.test(headerText);
    this.isRunning = false;
    this.injectionFailed = false;
    this.manifest = headerText.match(/\/\/ @manifest\s+(.+)\s*$/im)?.[1];
    this.noExec = noExec;
    // Construct regular expression to use to match target document
    let match, rex = {
      include: [],
      exclude: []
    };
    let findNextRe = /^\/\/ @(include|exclude)\s+(.+)\s*$/gm;
    while (match = findNextRe.exec(headerText)) {
      rex[match[1]].push(
        match[2].replace(/^main$/i, BROWSERCHROME).replace(/\*/g, '.*?')
      );
    }
    if (!rex.include.length) {
      rex.include.push(BROWSERCHROME);
    }
    let exclude = rex.exclude.length ? `(?!${rex.exclude.join('$|')}$)` : '';
    this.regex = new RegExp(`^${exclude}(${rex.include.join('|') || '.*'})$`,'i');
    
    if(this.inbackground){
      this.loadOrder = -1;
    }else{
      let loadOrder = headerText.match(/\/\/ @loadOrder\s+(\d+)\s*$/im)?.[1];
      this.loadOrder = Number.parseInt(loadOrder) || 10;
    }
    
    Object.seal(this);
  }
  get isEnabled() {
    return getDisabledScripts().indexOf(this.filename) === -1;
  }
  preCompileMJS(){
    if(this.#preCompiledESM){
      return Promise.resolve(this.#preCompiledESM)
    }
    if(this.#preCompileFailed){
      return Promise.resolve(null);
    }
    if(this.#preCompiling){
      return this.#preCompiling
    }
    this.#preCompiling = new Promise( resolve => {
      ChromeUtils.compileScript(`data:,"use strict";import("chrome://userscripts/content/${this.filename}").catch(console.error)`)
      .then( script => {
        this.#preCompiledESM = script;
        resolve(script);
      })
      .catch( (ex) => resolve(ScriptData.onCompileRejection(ex,this.filename)) )
      .finally(()=>{this.#preCompiling = null})
    });
    return this.#preCompiling
  }
  static onCompileRejection(ex,script){
    script.#preCompileFailed = true;
    console.error(`@ ${script.filename}: script couldn't be compiled because:`,ex);
    return null
  }
  tryLoadIntoWindow(win){
    if (this.inbackground || this.noExec || !this.regex.test(win.location.href)) {
      return
    }
    if(this.onlyonce && this.isRunning) {
      if(this.startup){
        SHARED_GLOBAL[this.startup]._startup(win)
      }
      return
    }
    const injection = this.isESM
      ? ScriptData.injectESMIntoGlobal(this,win)
      : ScriptData.injectClassicScriptIntoGlobal(this,win);
    injection
    .catch(ex => {
      console.error(new Error(`@ ${this.filename}:${ex.lineNumber}`,{cause:ex}));
    })
  }
  static markScriptRunning(aScript,aGlobal){
    aScript.isRunning = true;
    aScript.startup && SHARED_GLOBAL[aScript.startup]._startup(aGlobal);
    return
  }
  static injectESMIntoGlobal(aScript,aGlobal){
    return new Promise((resolve,reject) => {
      aScript.preCompileMJS()
      .then(script => script && script.executeInGlobal(aGlobal))
      .then(() => ScriptData.markScriptRunning(aScript,aGlobal))
      .then(resolve)
      .catch( ex => {
        aScript.injectionFailed = true;
        reject(ex)
      })
    })
  }
  static injectClassicScriptIntoGlobal(aScript,aGlobal){
    try{
      Services.scriptloader.loadSubScriptWithOptions(
        `chrome://userscripts/content/${aScript.filename}`,
        {
          target: aGlobal,
          ignoreCache: aScript.ignoreCache
        }
      )
      ScriptData.markScriptRunning(aScript,aGlobal)
      return Promise.resolve(1)
    }catch(ex){
      aScript.injectionFailed = true;
      ScriptData.markScriptRunning(aScript,aGlobal)
      return Promise.reject(ex)
    }
  }
  getInfo(isEnabledOverride){
    return ScriptInfo.fromScript(this,isEnabledOverride === undefined ? this.isEnabled : isEnabledOverride);
  }
  registerManifest(){
    if(this.isRunning){
      return
    }
    let cmanifest = FS.getEntry(`${this.manifest}.manifest`, {baseDirectory: FS.SCRIPT_DIR});
    if(cmanifest.isFile()){
      Components.manager
      .QueryInterface(Ci.nsIComponentRegistrar).autoRegister(cmanifest.entry());
    }else{
      console.warn(`Script '${this.filename}' tried to register a manifest but requested file '${this.manifest}' doesn't exist`);
    }
  }
  static extractHeaderText(aFSResult){
    return aFSResult.content()
      .match(/^\/\/ ==UserScript==\s*[\n\r]+(?:.*[\n\r]+)*?\/\/ ==\/UserScript==\s*/m)?.[0] || ""
  }
  static fromFile(aFile){
    if(aFile.fileSize < 24){
      // Smaller files can't possibly have a valid header
      return new ScriptData(aFile.leafName,"",aFile.fileSize === 0)
    }
    const result = FS.readFileSync(aFile,{ metaOnly: true });
    const headerText = this.extractHeaderText(result);
    // If there are less than 2 bytes after the header then we mark the script as non-executable. This means that if the file only has a header then we don't try to inject it to any windows, since it wouldn't do anything.
    return new ScriptData(aFile.leafName, headerText, headerText.length > aFile.fileSize - 2);
  }
}

YPref.setIfUnset(PREF_ENABLED,true);
YPref.setIfUnset(PREF_SCRIPTSDISABLED,"");
YPref.setIfUnset(PREF_GBROWSERHACKENABLED,false);

function showgBrowserNotification(){
  Services.prefs.setBoolPref(PREF_GBROWSERHACKENABLED,true);
  utils.showNotification(
  {
    label : "fx-autoconfig: Something was broken in last startup",
    type : "fx-autoconfig-gbrowser-notification",
    priority: "critical",
    buttons: [{
      label: "Why am I seeing this?",
      callback: (notification) => {
        notification.ownerGlobal.openWebLinkIn(
          "https://github.com/MrOtherGuy/fx-autoconfig#startup-error",
          "tab"
        );
        return false
      }
    }]
  }
  )
}

function showBrokenNotification(window){
  let aNotificationBox = window.gNotificationBox;
  aNotificationBox.appendNotification(
    "fx-autoconfig-broken-notification",
    {
      label: "fx-autoconfig: Startup is broken",
      image: "chrome://browser/skin/notification-icons/popup.svg",
      priority: "critical"
    },
    [{
      label: "Enable workaround",
      callback: (notification) => {
        Services.prefs.setBoolPref("userChromeJS.gBrowser_hack.required",true);
        utils.restart(false);
        return false
      }
    }]
  );
}

function escapeXUL(markup) {
  return markup.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case `<`:
        return "&lt;";
      case `>`:
        return "&gt;";
      case `&`:
        return "&amp;";
      case `'`:
        return "&apos;";
      case '"':
        return "&quot;";
    }
  });
}

function updateMenuStatus(event){
  const menu = event.target;
  if(!menu.id === "menuUserScriptsPopup"){
    return
  }
  let disabledScripts = getDisabledScripts();
  for(let item of menu.children){
    if(item.getAttribute("type") != "checkbox"){
      continue
    }
    if (disabledScripts.includes(item.getAttribute("filename"))){
      item.removeAttribute("checked");
    }else{
      item.setAttribute("checked","true");
    }
  }
}

class UserChrome_js{
  constructor(){
    this.scripts = [];
    this.SESSION_RESTORED = false;
    this.isInitialWindow = true;
    this.initialized = false;
    this.init();
  }
  init(){
    if(this.initialized){
      return
    }
    loaderModuleLink.setup(this,FX_AUTOCONFIG_VERSION,AppConstants.MOZ_APP_DISPLAYNAME_DO_NOT_USE,APP_VARIANT,SHARED_GLOBAL,ScriptData);
    // gBrowserHack setup
    const gBrowserHackRequired = Services.prefs.getBoolPref("userChromeJS.gBrowser_hack.required",false) ? 2 : 0;
    const gBrowserHackEnabled = Services.prefs.getBoolPref(PREF_GBROWSERHACKENABLED,false) ? 1 : 0;
    this.GBROWSERHACK_ENABLED = gBrowserHackRequired|gBrowserHackEnabled;
    const disabledScripts = getDisabledScripts();
    // load script data
    for(let entry of FS.getEntry('',{baseDirectory: FS.SCRIPT_DIR})){
      if (/^[A-Za-z0-9]+.*(\.uc\.js|\.uc\.mjs|\.sys\.mjs)$/i.test(entry.leafName)) {
        let script = ScriptData.fromFile(entry);
        this.scripts.push(script);
        if(disabledScripts.includes(script.filename)){
          continue
        }
        if(script.manifest){
          try{
            script.registerManifest();
          }catch(ex){
            console.error(new Error(`@ ${script.filename}`,{cause:ex}));
          }
        }
        if(script.inbackground){
          try{
            const fileName = `chrome://userscripts/content/${script.filename}`;
            if(script.isESM){
              ChromeUtils.importESModule( fileName );
            }else{
              ChromeUtils.import( fileName );
            }
            script.isRunning = true;
          }catch(ex){
            console.error(new Error(`@ ${script.filename}`,{cause:ex}));
          }
        }
        if(script.isESM && !script.inbackground){
          script.preCompileMJS();
        }
      }
    }
    this.scripts.sort((a,b) => a.loadOrder - b.loadOrder);
    Services.obs.addObserver(this, 'domwindowopened', false);
    this.initialized = true;
  }
  onDOMContent(document){
    const window = document.defaultView;
    if(!(/^chrome:(?!\/\/global\/content\/(commonDialog|alerts\/alert)\.xhtml)|about:(?!blank)/i).test(window.location.href)){
      // Don't inject scripts to modal prompt windows or notifications
      return
    }
    ChromeUtils.defineESModuleGetters(window,{
      _ucUtils: "chrome://userchromejs/content/utils.sys.mjs"
    });
    document.allowUnsafeHTML = false; // https://bugzilla.mozilla.org/show_bug.cgi?id=1432966
    
    // This is a hack to make gBrowser available for scripts.
    // Without it, scripts would need to check if gBrowser exists and deal
    // with it somehow. See bug 1443849
    const _gb = APP_VARIANT.FIREFOX && "_gBrowser" in window;
    if(this.GBROWSERHACK_ENABLED && _gb){
      window.gBrowser = window._gBrowser;
    }else if(_gb && this.isInitialWindow){
      this.isInitialWindow = false;
      let timeout = window.setTimeout(() => {
        showBrokenNotification(window);
      },5000);
      utils.windowIsReady(window)
      .then(() => {
        // startup is fine, clear timeout
        window.clearTimeout(timeout);
      })
    }
    
    // Inject scripts to window
    if(Services.prefs.getBoolPref(PREF_ENABLED,false)){
      const disabledScripts = getDisabledScripts();
      for(let script of this.scripts){
        if(script.inbackground || script.injectionFailed){
          continue
        }
        if(!disabledScripts.includes(script.filename)){
          script.tryLoadIntoWindow(window)
        }
      }
    }
    if(window.isChromeWindow){
      this.maybeAddScriptMenuItemsToWindow(window);
    }
  }
  // Add simple script menu to menubar tools popup
  maybeAddScriptMenuItemsToWindow(window){
    const document = window.document;
    const menu = document.querySelector(
      APP_VARIANT.FIREFOX ? "#menu_openDownloads" : "menuitem#addressBook");
    if(!menu){
      // this probably isn't main browser window so we don't have suitable target menu
      return
    }
    window.MozXULElement.insertFTLIfNeeded("toolkit/about/aboutSupport.ftl");
    let menuFragment = window.MozXULElement.parseXULToFragment(`
      <menu id="userScriptsMenu" label="userScripts">
        <menupopup id="menuUserScriptsPopup">
          <menuseparator></menuseparator>
          <menuitem id="userScriptsMenu-OpenFolder" label="Open folder" oncommand="_ucUtils.openScriptDir()"></menuitem>
          <menuitem id="userScriptsMenu-Restart" label="Restart" oncommand="_ucUtils.restart(false)" tooltiptext="Toggling scripts requires restart"></menuitem>
          <menuitem id="userScriptsMenu-ClearCache" label="Restart and clear startup cache" oncommand="_ucUtils.restart(true)" tooltiptext="Toggling scripts requires restart"></menuitem>
        </menupopup>
      </menu>
    `);
    const itemsFragment = window.MozXULElement.parseXULToFragment("");
    for(let script of this.scripts){
      itemsFragment.append(
        window.MozXULElement.parseXULToFragment(`
          <menuitem type="checkbox"
                    label="${escapeXUL(script.name || script.filename)}"
                    filename="${escapeXUL(script.filename)}"
                    checked="true"
                    oncommand="_ucUtils.toggleScript(this)">
          </menuitem>
      `)
      );
    }
    menuFragment.getElementById("menuUserScriptsPopup").prepend(itemsFragment);
    menu.parentNode.insertBefore(menuFragment,menu);
    menu.parentNode.querySelector("#menuUserScriptsPopup").addEventListener("popupshown",updateMenuStatus);
    document.l10n.formatValues(["restart-button-label","clear-startup-cache-label","show-dir-label"])
    .then(values => {
      let baseTitle = `${values[0]} ${utils.brandName}`;
      document.getElementById("userScriptsMenu-Restart").setAttribute("label", baseTitle);
      document.getElementById("userScriptsMenu-ClearCache").setAttribute("label", values[1].replace("…","") + " & " + baseTitle);
      document.getElementById("userScriptsMenu-OpenFolder").setAttribute("label",values[2])
    })
  }
  
  observe(aSubject, aTopic, aData) {
    aSubject.addEventListener('DOMContentLoaded', this, true);
  }
  
  handleEvent(aEvent){
    switch (aEvent.type){
      case "DOMContentLoaded":
        this.onDOMContent(aEvent.originalTarget);
        break;
      default:
        console.warn(new Error("unexpected event received",{cause:aEvent}));
    }
  }
  
}

const _ucjs = !Services.appinfo.inSafeMode && new UserChrome_js();
_ucjs && utils.startupFinished().then(() => {
  _ucjs.SESSION_RESTORED = true;
  _ucjs.GBROWSERHACK_ENABLED === 2 && showgBrowserNotification();
  if(YPref.setIfUnset("userChromeJS.firstRunShown",true)){
    utils.showNotification({
      type: "fx-autoconfig-installed",
      label: `fx-autoconfig: ${utils.brandName} is being modified with custom autoconfig scripting`
    });
  }
});
