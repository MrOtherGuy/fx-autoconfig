let EXPORTED_SYMBOLS = [];

console.warn( "Browser is executing custom scripts via autoconfig" );

const FX_AUTOCONFIG_VERSION = "0.7";
const Services =
  globalThis.Services ||
  ChromeUtils.import("resource://gre/modules/Services.jsm").Services;
const {AppConstants} = ChromeUtils.import('resource://gre/modules/AppConstants.jsm');
const FS = ChromeUtils.import("chrome://userchromejs/content/fs.jsm").FileSystem;

const yPref = {
  get: function (prefPath) {
    const sPrefs = Services.prefs;
    try {
      switch (sPrefs.getPrefType(prefPath)) {
        case 0:
          return undefined;
        case 32:
          return sPrefs.getStringPref(prefPath);
        case 64:
          return sPrefs.getIntPref(prefPath);
        case 128:
          return sPrefs.getBoolPref(prefPath);
      }
    } catch (ex) {
      return undefined;
    }
    return;
  },
  set: function (prefPath, value) {
    const sPrefs = Services.prefs;
    switch (typeof value) {
      case 'string':
        return sPrefs.setCharPref(prefPath, value) || value;
      case 'number':
        return sPrefs.setIntPref(prefPath, value) || value;
      case 'boolean':
        return sPrefs.setBoolPref(prefPath, value) || value;
    }
    return;
  },
  addListener:(a,b) => {
    let o = (q,w,e)=>(b(yPref.get(e),e));
    Services.prefs.addObserver(a,o);
    return{pref:a,observer:o}
  },
  removeListener:(a)=>( Services.prefs.removeObserver(a.pref,a.observer) )
};

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

class ScriptData {
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
    this.isESM = this.filename.endsWith("sys.mjs");
    this.onlyonce = /\/\/ @onlyonce\b/.test(headerText);
    this.inbackground = this.isESM || /\/\/ @backgroundmodule\b/.test(headerText);
    this.ignoreCache = /\/\/ @ignorecache\b/.test(headerText);
    this.isRunning = false;
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
    return (yPref.get(PREF_SCRIPTSDISABLED) || '')
           .split(',').indexOf(this.filename) === -1;
  }
  
  tryLoadIntoWindow(win) {
    if (this.inbackground || this.noExec || !this.regex.test(win.location.href)) {
      return
    }
    try {
      if(this.onlyonce && this.isRunning) {
        if (this.startup) {
          SHARED_GLOBAL[this.startup]._startup(win)
        }
        return
      }

      Services.scriptloader.loadSubScriptWithOptions(
        `chrome://userscripts/content/${this.filename}`,
        {
          target: win,
          ignoreCache: this.ignoreCache
        }
      );
      
      this.isRunning = true;
      this.startup && SHARED_GLOBAL[this.startup]._startup(win)
      
    } catch (ex) {
      console.error(new Error(`@ ${this.filename}:${ex.lineNumber}`,{cause:ex}));
    }
    return
  }
  
  getInfo(){
    return ScriptInfo.fromScript(this,this.isEnabled);
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
// _ucUtils.getScriptData() returns these types of objects
class ScriptInfo{
  constructor(enabled){
    this.isEnabled = enabled
  }
  asFile(){
    return FS.getEntry(this.filename,{baseDirectory: FS.SCRIPT_DIR});
  }
  static fromScript(aScript, isEnabled){
    let info = new ScriptInfo(isEnabled);
    Object.assign(info,aScript);
    info.regex = new RegExp(aScript.regex.source, aScript.regex.flags);
    return info
  }
  static fromString(aName, aStringAsFSResult) {
    const headerText = ScriptData.extractHeaderText(aStringAsFSResult);
    const scriptData = new ScriptData(aName, headerText, headerText.length > aStringAsFSResult.size - 2);
    return ScriptInfo.fromScript(scriptData, false)
  }
}

function updateStyleSheet(name,type) {
  if(type){
    let sss = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
    try{
      let uri = Services.io.newURI(`chrome://userchrome/content/${name}`);
      switch(type){
        case "agent":
          sss.unregisterSheet(uri,sss.AGENT_SHEET);
          sss.loadAndRegisterSheet(uri,sss.AGENT_SHEET);
          return true
        case "author":
          sss.unregisterSheet(uri,sss.AUTHOR_SHEET);
          sss.loadAndRegisterSheet(uri,sss.AUTHOR_SHEET);
          return true
        default:
          return false
      }
    }catch(e){
      console.error(e);
      return false
    }
  }
  let fsResult = FS.getEntry(name);
  if(!fsResult.isFile()){
    return false
  }
  let recentWindow = Services.wm.getMostRecentBrowserWindow();
  if(!recentWindow){
    return false
  }
  function recurseImports(sheet,all){
    let z = 0;
    let rule = sheet.cssRules[0];
    // loop through import rules and check that the "all"
    // doesn't already contain the same object
    while(rule instanceof CSSImportRule && !all.includes(rule.styleSheet) ){
      all.push(rule.styleSheet);
      recurseImports(rule.styleSheet,all);
      rule = sheet.cssRules[++z];
    }
    return all
  }
  
  let sheets = recentWindow.InspectorUtils.getAllStyleSheets(recentWindow.document,false);
  
  sheets = sheets.flatMap( x => recurseImports(x,[x]) );
  
  // If a sheet is imported multiple times, then there will be
  // duplicates, because style system does create an object for
  // each instace but that's OK since sheets.find below will
  // only find the first instance and reload that which is
  // "probably" fine.
  let entryFilePath = `file:///${fsResult.entry().path.replaceAll("\\","/")}`;
  
  let target = sheets.find(sheet => sheet.href === entryFilePath);
  if(target){
    recentWindow.InspectorUtils.parseStyleSheet(target,fsResult.readSync());
    return true
  }
  return false
}

const utils = {
  get version(){ return FX_AUTOCONFIG_VERSION },
  get sharedGlobal(){ return SHARED_GLOBAL },
  
  get brandName(){ return AppConstants.MOZ_APP_DISPLAYNAME_DO_NOT_USE },
  
  createElement: function(doc,tag,props,isHTML = false){
    let el = isHTML ? doc.createElement(tag) : doc.createXULElement(tag);
    for(let prop in props){
      el.setAttribute(prop,props[prop])
    }
    return el
  },
  fs: FS,
  createWidget(desc){
    if(!desc || !desc.id ){
      throw new Error("custom widget description is missing 'id' property");
    }
    if(!(desc.type === "toolbarbutton" || desc.type === "toolbaritem")){
      throw new Error(`custom widget has unsupported type: '${desc.type}'`);
    }
    const CUI = Services.wm.getMostRecentBrowserWindow().CustomizableUI;
    
    if(CUI.getWidget(desc.id)?.hasOwnProperty("source")){
      // very likely means that the widget with this id already exists
      // There isn't a very reliable way to 'really' check if it exists or not
      throw new Error(`Widget with ID: '${desc.id}' already exists`);
    }
    // This is pretty ugly but makes onBuild much cleaner.
    let itemStyle = "";
    if(desc.image){
      if(desc.type==="toolbarbutton"){
        itemStyle += "list-style-image:";
      }else{
        itemStyle += "background: transparent center no-repeat ";
      }
      itemStyle += /^chrome:\/\/|resource:\/\//.test(desc.image)
        ? `url(${desc.image});`
        : `url(chrome://userChrome/content/${desc.image});`;
      itemStyle += desc.style || "";
    }
    SHARED_GLOBAL.widgetCallbacks.set(desc.id,desc.callback);

    return CUI.createWidget({
      id: desc.id,
      type: 'custom',
      defaultArea: desc.area || CUI.AREA_NAVBAR,
      onBuild: function(aDocument) {
        let toolbaritem = aDocument.createXULElement(desc.type);
        let props = {
          id: desc.id,
          class: `toolbarbutton-1 chromeclass-toolbar-additional ${desc.class?desc.class:""}`,
          overflows: !!desc.overflows,
          label: desc.label || desc.id,
          tooltiptext: desc.tooltip || desc.id,
          style: itemStyle,
          onclick: `${desc.allEvents?"":"event.button===0 && "}_ucUtils.sharedGlobal.widgetCallbacks.get(this.id)(event,window)`
        };
        for (let p in props){
          toolbaritem.setAttribute(p, props[p]);
        }
        return toolbaritem;
      }
    });
  },
  getScriptData: (aFilter) => {
    const filterType = typeof aFilter;
    if(aFilter && !(filterType === "string" || filterType === "function")){
      throw "getScriptData() called with invalid filter type: "+filterType
    }
    if(filterType === "string"){
      let script = _ucjs.scripts.find(s => s.filename === aFilter);
      return script ? ScriptInfo.fromScript(script, script.isEnabled) : null;
    }
    const disabledScripts = (yPref.get(PREF_SCRIPTSDISABLED) || '').split(",");
    if(filterType === "function"){
      return _ucjs.scripts.filter(aFilter).map(
        (script) => ScriptInfo.fromScript(script,!disabledScripts.includes(script.filename))
      );
    }
    return _ucjs.scripts.map(
      (script) => ScriptInfo.fromScript(script,!disabledScripts.includes(script.filename))
    );
  },
  
  get windows(){
    return {
      get: function (onlyBrowsers = true) {
        let windowType = APP_VARIANT.FIREFOX ? "navigator:browser" : "mail:3pane";
        let windows = Services.wm.getEnumerator(onlyBrowsers ? windowType : null);
        let wins = [];
        while (windows.hasMoreElements()) {
          wins.push(windows.getNext());
        }
        return wins
      },
      forEach: function(fun,onlyBrowsers = true){
        let wins = this.get(onlyBrowsers);
        wins.forEach((w)=>(fun(w.document,w)))
      }
    }
  },
  
  toggleScript: function(el){
    let isElement = !!el.tagName;
    if(!isElement && typeof el != "string"){
      return
    }
    const name = isElement ? el.getAttribute("filename") : el;
    let script = _ucjs.scripts.find(script => script.filename === name);
    if(!script){
      return null
    }
    let newstate = true;
    if (script.isEnabled) {
      yPref.set(PREF_SCRIPTSDISABLED, `${script.filename},${yPref.get(PREF_SCRIPTSDISABLED)}`);
      newstate = false;
    } else {
      yPref.set(PREF_SCRIPTSDISABLED, yPref.get(PREF_SCRIPTSDISABLED).replace(new RegExp(`^${script.filename},?|,${script.filename}`), ''));
    }
    Services.appinfo.invalidateCachesOnRestart();
    return { script: name, enabled: newstate }
  },
  
  updateStyleSheet: function(name = "../userChrome.css",type){
    return updateStyleSheet(name,type)
  },
  
  updateMenuStatus: function(menu){
    if(!menu){
      return
    }
    let disabledScripts = yPref.get(PREF_SCRIPTSDISABLED).split(",");
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
  },
  
  startupFinished: function(){
    return new Promise(resolve => {
      if(_ucjs.SESSION_RESTORED){
        resolve();
      }else{
        const obs_topic = APP_VARIANT.FIREFOX
                    ? "sessionstore-windows-restored"
                    : "mail-delayed-startup-finished";
                    
        let observer = (subject, topic, data) => {
          Services.obs.removeObserver(observer, obs_topic);
          resolve();
        };
        Services.obs.addObserver(observer, obs_topic);
      }
    });
  },
  
  windowIsReady: function(win){
    if(win && win.isChromeWindow){
      return new Promise(resolve => {
        
        if(APP_VARIANT.FIREFOX){
          if(win.gBrowserInit.delayedStartupFinished){
            resolve();
            return
          }
        }else{ // APP_VARIANT = THUNDERBIRD
          if(win.gMailInit.delayedStartupFinished){
            resolve();
            return
          }
        }
        const obs_topic = APP_VARIANT.FIREFOX
                          ? "browser-delayed-startup-finished"
                          : "mail-delayed-startup-finished";
                    
        let observer = (subject, topic, data) => {
          if(subject === win){
            Services.obs.removeObserver(observer, obs_topic);
            resolve();
          }
        };
        Services.obs.addObserver(observer, obs_topic);

      });
    }else{
      return Promise.reject(new Error("reference is not a window"))
    }
  },
  
  registerHotkey: function(desc,func){
    const validMods = ["accel","alt","ctrl","meta","shift"];
    const validKey = (k)=>((/^[\w-]$/).test(k) ? 1 : (/^F(?:1[0,2]|[1-9])$/).test(k) ? 2 : 0);
    const NOK = (a) => (typeof a != "string");
    const eToO = (e) => ({"metaKey":e.metaKey,"ctrlKey":e.ctrlKey,"altKey":e.altKey,"shiftKey":e.shiftKey,"key":e.srcElement.getAttribute("key"),"id":e.srcElement.getAttribute("id")});
    
    if(NOK(desc.id) || NOK(desc.key) || NOK(desc.modifiers)){
      return false
    }
    
    try{
      let mods = desc.modifiers.toLowerCase().split(" ").filter((a)=>(validMods.includes(a)));
      let key = validKey(desc.key);
      if(!key || (mods.length === 0 && key === 1)){
        return false
      }
      
      utils.windows.forEach((doc,win) => {
        if(doc.getElementById(desc.id)){
          return
        }
        let details = { "id": desc.id, "modifiers": mods.join(",").replace("ctrl","accel"), "oncommand": "//" };
        if(key === 1){
          details.key = desc.key.toUpperCase();
        }else{
          details.keycode = `VK_${desc.key}`;
        }

        let el = utils.createElement(doc,"key",details);
        
        el.addEventListener("command",(ev) => {func(ev.target.ownerGlobal,eToO(ev))});
        let keyset = doc.getElementById("mainKeyset") || doc.body.appendChild(utils.createElement(doc,"keyset",{id:"ucKeys"}));
        keyset.insertBefore(el,keyset.firstChild);
      });
    }catch(e){
      console.error(e);
      return false
    }
    return true
  },
  loadURI: function(win,desc){
    if(APP_VARIANT.THUNDERBIRD){
      console.warn("_ucUtils.loadURI is not supported on Thunderbird");
      return false
    }
    if(    !win
        || !desc 
        || !desc.url 
        || typeof desc.url !== "string"
        || !(["tab","tabshifted","window","current"]).includes(desc.where)
      ){
      return false
    }
    const isJsURI = desc.url.slice(0,11) === "javascript:";
    try{
      win.openTrustedLinkIn(
        desc.url,
        desc.where,
        { "allowPopups":isJsURI,
          "inBackground":false,
          "allowInheritPrincipal":false,
          "private":!!desc.private,
          "userContextId":desc.url.startsWith("http")?desc.userContextId:null});
    }catch(e){
      console.error(e);
      return false
    }
    return true
  },
  get prefs(){ return yPref },

  showNotification: async function(description){
    if(APP_VARIANT.THUNDERBIRD){
      console.warn('_ucUtils.showNotification is not supported on Thunderbird\nNotification label was: "'+description.label+'"');
      return
    }
    await utils.startupFinished();
    let window = description.window;
    if(!(window && window.isChromeWindow)){
      window = Services.wm.getMostRecentBrowserWindow();
    }
    let aNotificationBox = window.gNotificationBox;
    if(description.tab){
      let aBrowser = description.tab.linkedBrowser;
      if(!aBrowser){ return }
      aNotificationBox = window.gBrowser.getNotificationBox(aBrowser);
    }
    if(!aNotificationBox){ return }
    let type = description.type || "default";
    let priority = aNotificationBox.PRIORITY_INFO_HIGH;
    switch (description.priority){
      case "system":
        priority = aNotificationBox.PRIORITY_SYSTEM;
        break;
      case "critical":
        priority = aNotificationBox.PRIORITY_CRITICAL_HIGH;
        break;
      case "warning":
        priority = aNotificationBox.PRIORITY_WARNING_HIGH;
        break;
    }
    aNotificationBox.appendNotification(
      type,
      {
        label: description.label || "ucUtils message",
        image: "chrome://browser/skin/notification-icons/popup.svg",
        priority: priority,
        eventCallback: typeof description.callback === "function" ? description.callback : null
      },
      description.buttons
    );
  },

  restart: function (clearCache){
    clearCache && Services.appinfo.invalidateCachesOnRestart();
    let cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].createInstance(Ci.nsISupportsPRBool);
    Services.obs.notifyObservers(
      cancelQuit,
      "quit-application-requested",
      "restart"
    );
    if (!cancelQuit.data) {
      Services.startup.quit(
        Services.startup.eAttemptQuit | Services.startup.eRestart
      );
      return true
    }
    return false
  },
  
  parseStringAsScriptInfo: (aName, aString) => ScriptInfo.fromString(aName, FS.StringContent({content: aString})),
  
  openScriptDir: () => FS.getEntry("",{baseDirectory: FS.SCRIPT_DIR}).showInFileManager(),
  
  /** LEGACY FileSystem helpers, don't use - will be removed in near future
   *  Use _ucUtils.fs. methods instead.
   */
  readFile: function (aFile, metaOnly = false, replaceNewlines = true){
    let result = FS.readFileSync(aFile,{metaOnly: metaOnly});
    if(result.isError()){
      return null
    }
    if(!result.isContent()){
      throw new Error("aFile is not a readable file")
    }
    return result.content(replaceNewlines)
  },
  
  readFileAsync: async function(path){
    let result = await FS.readFile(path);
    return result.content()
  },
  
  readJSON: function(path){
    return FS.readJSON(path);
  },
  
  writeFile: function(path, content, options = {}){
    return FS.writeFile(path, content, options)
  },
  
  createFileURI: (fileName = "") => FS.createFileURI(fileName),
  
  get chromeDir(){
    return {
      get files(){
        const dir = Services.dirsvc.get('UChrm',Ci.nsIFile);
        return dir.directoryEntries.QueryInterface(Ci.nsISimpleEnumerator)
      },
      uri: FS.BASE_FILEURI
    }
  },
  
  getFSEntry: (fileName, autoEnumerate = true) => {
    let result = FS.getEntry(fileName);
    if(result.isError() || result.isContent()){
      return null
    }
    if(result.isDirectory() && autoEnumerate){
      return result.entry().directoryEntries.QueryInterface(Ci.nsISimpleEnumerator)
    }
    return result.entry()
  }
  
}

Object.freeze(utils);

if (yPref.get(PREF_ENABLED) === undefined) {
  yPref.set(PREF_ENABLED, true);
}

if (yPref.get(PREF_SCRIPTSDISABLED) === undefined) {
  yPref.set(PREF_SCRIPTSDISABLED, '');
}

if (yPref.get(PREF_GBROWSERHACKENABLED) === undefined) {
  yPref.set(PREF_GBROWSERHACKENABLED, false);
}

function showgBrowserNotification(){
  yPref.set(PREF_GBROWSERHACKENABLED,true);
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
        yPref.set("userChromeJS.gBrowser_hack.required",true);
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
    // gBrowserHack setup
    const gBrowserHackRequired = yPref.get("userChromeJS.gBrowser_hack.required") ? 2 : 0;
    const gBrowserHackEnabled = yPref.get(PREF_GBROWSERHACKENABLED) ? 1 : 0;
    this.GBROWSERHACK_ENABLED = gBrowserHackRequired|gBrowserHackEnabled;
    const disabledScripts = (yPref.get(PREF_SCRIPTSDISABLED) || '').split(",");
    // load script data
    for(let entry of FS.getEntry('',{baseDirectory: FS.SCRIPT_DIR})){
      if (/(.+\.uc\.js|.+\.sys\.mjs)$/i.test(entry.leafName)) {
        let script = ScriptData.fromFile(entry);
        this.scripts.push(script);
        const scriptIsEnabled = !disabledScripts.includes(script.fileName);
        if(scriptIsEnabled && script.manifest){
          try{
            script.registerManifest();
          }catch(ex){
            console.error(new Error(`@ ${script.filename}`,{cause:ex}));
          }
        }
        if(scriptIsEnabled && script.inbackground){
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
    // TODO maybe store utils differently?
    Object.defineProperty(window,"_ucUtils",{ get: () => utils });
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
    if(yPref.get(PREF_ENABLED)){
      const disabledScripts = (yPref.get(PREF_SCRIPTSDISABLED) || '').split(",");
      for(let script of this.scripts){
        if(script.inbackground){
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
        <menupopup id="menuUserScriptsPopup" onpopupshown="_ucUtils.updateMenuStatus(this)">
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
  if(!yPref.get("userChromeJS.firstRunShown")){
    yPref.set("userChromeJS.firstRunShown",true);
    utils.showNotification({
      type: "fx-autoconfig-installed",
      label: `fx-autoconfig: ${utils.brandName} is being modified with custom autoconfig scripting`
    });
  }
});
