let EXPORTED_SYMBOLS = [];

console.warn( "Browser is executing custom scripts via autoconfig" );
const {Services} = ChromeUtils.import('resource://gre/modules/Services.jsm');
const {AppConstants} = ChromeUtils.import('resource://gre/modules/AppConstants.jsm');

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

function resolveChromeURL(str){
  const registry = Cc["@mozilla.org/chrome/chrome-registry;1"].getService(Ci.nsIChromeRegistry);
  try{
    return registry.convertChromeURL(Services.io.newURI(str.replace(/\\/g,"/"))).spec
  }catch(e){
    console.error(e);
    return ""
  }
}

// relative to "chrome" folder
function resolveChromePath(str){
  let parts = resolveChromeURL(str).split("/");
  return parts.slice(parts.indexOf("chrome") + 1,parts.length - 1).join("/");
}

const SHARED_GLOBAL = {};
Object.defineProperty(SHARED_GLOBAL,"widgetCallbacks",{value:new Map()});

const BROWSERCHROME = 'chrome://browser/content/browser.xhtml';
const PREF_ENABLED = 'userChromeJS.enabled';
const PREF_SCRIPTSDISABLED = 'userChromeJS.scriptsDisabled';
const PREF_GBROWSERHACKENABLED = 'userChromeJS.gBrowser_hack.enabled';
const SCRIPT_DIR = resolveChromePath('chrome://userscripts/content/');
const RESOURCE_DIR = resolveChromePath('chrome://userchrome/content/');
const BASE_FILEURI = Services.io.getProtocolHandler('file')
                    .QueryInterface(Ci.nsIFileProtocolHandler)
                    .getURLSpecFromDir(Services.dirsvc.get('UChrm',Ci.nsIFile));

class ScriptData {
  constructor(leafName, headerText){
    this.filename = leafName;
    this.name = headerText.match(/\/\/ @name\s+(.+)\s*$/im)?.[1];
    this.charset = headerText.match(/\/\/ @charset\s+(.+)\s*$/im)?.[1];
    this.description = headerText.match(/\/\/ @description\s+(.+)\s*$/im)?.[1];
    this.version = headerText.match(/\/\/ @version\s+(.+)\s*$/im)?.[1];
    this.author = headerText.match(/\/\/ @author\s+(.+)\s*$/im)?.[1];
    this.homepageURL = headerText.match(/\/\/ @homepageURL\s+(.+)\s*$/im)?.[1];
    this.downloadURL = headerText.match(/\/\/ @downloadURL\s+(.+)\s*$/im)?.[1];
    this.updateURL = headerText.match(/\/\/ @updateURL\s+(.+)\s*$/im)?.[1];
    this.optionsURL = headerText.match(/\/\/ @optionsURL\s+(.+)\s*$/im)?.[1];
    this.startup = headerText.match(/\/\/ @startup\s+(.+)\s*$/im)?.[1];
    this.id = headerText.match(/\/\/ @id\s+(.+)\s*$/im)?.[1]
           || `${leafName.split('.uc.js')[0]}@${this.author||'userChromeJS'}`;
    
    this.onlyonce = /\/\/ @onlyonce\b/.test(headerText);
    this.inbackground = /\/\/ @backgroundmodule\b/.test(headerText);
    this.ignoreCache = /\/\/ @ignorecache\b/.test(headerText);
    this.isRunning = false;
    
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
    if (this.inbackground || !this.regex.test(win.location.href)) {
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
      console.error(new Error(`@ ${this.filename}`,{cause:ex}));
    }
    return
  }
  
  getInfo(){
    let info = {...this};
    info.regex = new RegExp(this.regex.source,this.regex.flags);
    return info;
  }
  
  static fromFile(aFile){
    const headerText = utils.readFile(aFile,true)
    .match(/^\/\/ ==UserScript==\s*\n(?:.*\n)*?\/\/ ==\/UserScript==\s*\n/m);
    return new ScriptData(aFile.leafName, headerText ? headerText[0] : '');
  }
}

function getDirEntry(filename,isLoader = false){
  if(typeof filename !== "string"){
    return null
  }
  filename = filename.replace("\\","/");
  let pathParts = ((filename.startsWith("..") ? "" : (isLoader ? SCRIPT_DIR : RESOURCE_DIR)) + "/" + filename)
                  .split("/").filter( (a) => (!!a && a != "..") );
  let entry = Services.dirsvc.get('UChrm',Ci.nsIFile);
  
  for(let part of pathParts){
    entry.append(part)
  }
  if(!entry.exists()){
    return null
  }
  if(entry.isDirectory()){
    return entry.directoryEntries.QueryInterface(Ci.nsISimpleEnumerator);
  }else if(entry.isFile()){
    return entry
  }else{
    return null
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
  let entry = getDirEntry(name);
  if(!(entry && entry.isFile())){
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
  let entryFilePath = `file:///${entry.path.replaceAll("\\","/")}`;
  
  let target = sheets.find(sheet => sheet.href === entryFilePath);
  if(target){
    recentWindow.InspectorUtils.parseStyleSheet(target,utils.readFile(entry));
    return true
  }
  return false
}

const utils = {

  get sharedGlobal(){ return SHARED_GLOBAL },
  
  get brandName(){ return AppConstants.MOZ_APP_DISPLAYNAME_DO_NOT_USE },
  
  createElement: function(doc,tag,props,isHTML = false){
    let el = isHTML ? doc.createElement(tag) : doc.createXULElement(tag);
    for(let prop in props){
      el.setAttribute(prop,props[prop])
    }
    return el
  },
  
  createWidget(desc){
    if(!desc || !desc.id ){
      console.error("custom widget description is missing 'id' property");
      return null
    }
    if(!(['toolbaritem','toolbarbutton']).includes(desc.type)){
      console.error("custom widget has unsupported type: "+desc.type);
      return null
    }
    const CUI = Services.wm.getMostRecentBrowserWindow().CustomizableUI;
    let newWidget = CUI.getWidget(desc.id);

    if(newWidget && newWidget.hasOwnProperty("source")){
      // very likely means that the widget with this id already exists
      // There isn't a very reliable way to 'really' check if it exists or not
      return newWidget
    }
    // This is pretty ugly but makes onBuild much cleaner.
    let itemStyle = "";
    if(desc.image){
      if(desc.type==="toolbarbutton"){
        itemStyle += "list-style-image:";
      }else{
        itemStyle += "background: transparent center no-repeat ";
      }
      itemStyle += `url(chrome://userChrome/content/${desc.image});`;
      itemStyle += desc.style || "";
    }
    SHARED_GLOBAL.widgetCallbacks.set(desc.id,desc.callback);

    return CUI.createWidget({
      id: desc.id,
      type: 'custom',
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
  
  readFile: function (aFile, metaOnly = false) {
    if(typeof aFile === "string"){
      aFile = getDirEntry(aFile);
    }
    if(!aFile){
      return null
    }
    let stream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
    let cvstream = Cc['@mozilla.org/intl/converter-input-stream;1'].createInstance(Ci.nsIConverterInputStream);
    try{
      stream.init(aFile, 0x01, 0, 0);
      cvstream.init(stream, 'UTF-8', 1024, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
    }catch(e){
      console.error(e);
      return null
    }
    let content = '',
    data = {};
    while (cvstream.readString(4096, data)) {
      content += data.value;
      if (metaOnly && content.indexOf('// ==/UserScript==') > 0) {
        break;
      }
    }
    cvstream.close();
    stream.close();
    return content.replace(/\r\n?/g, '\n');
  },
  
  readFileAsync: function(path){
    if(typeof path !== "string"){
      return Promise.reject("readFileAsync: path is not a string")
    }
    let base = ["chrome",RESOURCE_DIR];
    let parts = path.split(/[\\\/]/);
    while(parts[0] === ".."){
      base.pop();
      parts.shift();
    }
    return IOUtils.readUTF8(
      PathUtils.join( PathUtils.profileDir, ...base.concat(parts) )
    )
  },
  
  readJSON: async function(path){
    try{
      let content = await utils.readFileAsync(path);
      return JSON.parse(content);
    }catch(ex){
      console.error(ex)
    }
    return null
  },
  
  writeFile: async function(path, content, options = {}){
    if(!path || typeof path !== "string"){
      throw "writeFile: path is invalid"
    }
    if(typeof content !== "string"){
      throw "writeFile: content to write must be a string"
    }

    let base = ["chrome",RESOURCE_DIR];
    let parts = path.split(/[\\\/]/);
    
    // Normally, this API can only write into resources directory
    // Writing outside of resources can be enabled using following pref
    const disallowUnsafeWrites = !yPref.get("userChromeJS.allowUnsafeWrites");

    while(parts[0] === ".."){
      if(disallowUnsafeWrites){
        throw "Writing outside of resources directory is not allowed"
      }
      base.pop();
      parts.shift();
    }
    const fileName = PathUtils.join( PathUtils.profileDir, ...base.concat(parts) );
    
    if(!options.tmpPath){
      options.tmpPath = fileName + ".tmp";
    }
    return IOUtils.writeUTF8( fileName, content, options );
  },
  
  createFileURI: (fileName = "") => {
    fileName = String(fileName);
    let u = resolveChromeURL(`chrome://userchrome/content/${fileName}`);
    return fileName ? u : u.substr(0,u.lastIndexOf("/") + 1); 
  },
  
  get chromeDir(){
    return {
      get files(){
        const dir = Services.dirsvc.get('UChrm',Ci.nsIFile);
        return dir.directoryEntries.QueryInterface(Ci.nsISimpleEnumerator)
      },
      uri: BASE_FILEURI
    }
  },
  
  getFSEntry: (fileName) => ( getDirEntry(fileName) ),
  
  getScriptData: () => {
    let scripts = [];
    const disabledScripts = (yPref.get(PREF_SCRIPTSDISABLED) || '').split(",");
    for(let script of _ucjs.scripts){
      let scriptInfo = script.getInfo();
      scriptInfo.isEnabled = !disabledScripts.includes(script.filename);
      scripts.push(scriptInfo);
    }
    return scripts
  },
  
  get windows(){
    return {
      get: function (onlyBrowsers = true) {
        let windows = Services.wm.getEnumerator(onlyBrowsers ? 'navigator:browser' : null);
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
        let observer = (subject, topic, data) => {
          Services.obs.removeObserver(observer, "sessionstore-windows-restored");
          resolve();
        };
        Services.obs.addObserver(observer, "sessionstore-windows-restored");
      }
    });
  },
  
  windowIsReady: function(win){
    if(win && win.isChromeWindow){
      return new Promise(resolve => {
        if(win.gBrowserInit.delayedStartupFinished){
          resolve();
        }else{
          let observer = (subject, topic, data) => {
            if(subject === win){
              Services.obs.removeObserver(observer, "browser-delayed-startup-finished");
              resolve();
            }
          };
          Services.obs.addObserver(observer, "browser-delayed-startup-finished");
        }
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
    Services.startup.quit( Services.startup.eAttemptQuit | Services.startup.eRestart )
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

function UserChrome_js() {
  this.scripts = [];
  this.SESSION_RESTORED = false;
  this.isInitialWindow = true;
  
  const gBrowserHackRequired = yPref.get("userChromeJS.gBrowser_hack.required") ? 2 : 0;
  const gBrowserHackEnabled = yPref.get(PREF_GBROWSERHACKENABLED) ? 1 : 0;
  this.GBROWSERHACK_ENABLED = gBrowserHackRequired|gBrowserHackEnabled;
  
  if(!yPref.get(PREF_ENABLED) || !(/^[\w_]*$/.test(SCRIPT_DIR))){
    console.log("Scripts are disabled or the given script directory name is invalid");
    return
  }
  let files = getDirEntry('',true);
  while(files.hasMoreElements()){
    let file = files.getNext().QueryInterface(Ci.nsIFile);
    if (/\.uc\.js$/i.test(file.leafName)) {
      let script = ScriptData.fromFile(file);
      this.scripts.push(script);
      if(script.inbackground && script.isEnabled){
        try{
          ChromeUtils.import(`chrome://userscripts/content/${script.filename}`);
          script.isRunning = true;
        }catch(e){
          console.error(e);
        }
      }
    }
  }
  this.scripts.sort((a,b) => a.loadOrder > b.loadOrder);
  
  Services.obs.addObserver(this, 'domwindowopened', false);
}

UserChrome_js.prototype = {
  observe: function (aSubject, aTopic, aData) {
      aSubject.addEventListener('DOMContentLoaded', this, true);
  },

  handleEvent: function (aEvent) {
    let document = aEvent.originalTarget;
    let window = document.defaultView;
    let regex = /^chrome:(?!\/\/global\/content\/(commonDialog|alerts\/alert)\.xhtml)|about:(?!blank)/i;
    // Don't inject scripts to modal prompt windows or notifications
    if(regex.test(window.location.href)) {
      Object.defineProperty(window,"_ucUtils",{ get: () => utils });
      document.allowUnsafeHTML = false; // https://bugzilla.mozilla.org/show_bug.cgi?id=1432966
      
      // This is a hack to make gBrowser available for scripts.
      // Without it, scripts would need to check if gBrowser exists and deal
      // with it somehow. See bug 1443849
      const _gb = "_gBrowser" in window;
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
      let isWindow = window.isChromeWindow;
      
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

      // Add simple script menu to menubar tools popup
      const menu = document.querySelector("#menu_openDownloads");
      if(isWindow && menu){
        window.MozXULElement.insertFTLIfNeeded("toolkit/about/aboutSupport.ftl");
        let menuFragment = window.MozXULElement.parseXULToFragment(`
          <menu id="userScriptsMenu" label="userScripts">
            <menupopup id="menuUserScriptsPopup" onpopupshown="_ucUtils.updateMenuStatus(this)">
              <menuseparator></menuseparator>
              <menuitem id="userScriptsRestart" label="Restart" oncommand="_ucUtils.restart(false)" tooltiptext="Toggling scripts requires restart"></menuitem>
              <menuitem id="userScriptsClearCache" label="Restart and clear startup cache" oncommand="_ucUtils.restart(true)" tooltiptext="Toggling scripts requires restart"></menuitem>
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
        
        document.l10n.formatValues(["restart-button-label","clear-startup-cache-label"])
        .then(values => {
          let baseTitle = `${values[0]} ${utils.brandName}`;
          document.getElementById("userScriptsRestart").setAttribute("label", baseTitle);
          document.getElementById("userScriptsClearCache").setAttribute("label", values[1].replace("…","") + " & " + baseTitle);
        })
      }
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
