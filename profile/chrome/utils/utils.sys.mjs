import { FileSystem as FS } from "chrome://userchromejs/content/fs.sys.mjs";

export class YPref{
  #type;
  #name;
  #observerCallbacks;
  constructor(pref,type,value){
    this.#name = pref;
    this.#type = type;
  }
  exists(){
    return this.#type > 0;
  }
  get name(){
    return this.#name
  }
  get value(){
    try{
      return YPref.getPrefOfType(this.#name,this.#type)
    }catch(ex){
      this.#type = 0
    }
    return null
  }
  set value(some){
    this.setTo(some);
  }
  defaultTo(value){
    if(this.#type > 0){
      return false
    }
    this.setTo(value);
    return true
  }
  hasUserValue(){
    return this.#type > 0 && Services.prefs.prefHasUserValue(this.#name)
  }
  get type(){
    if(this.#type === 32)
      return "string"
    if(this.#type === 64)
      return "number"
    if(this.#type === 128)
      return "boolean"
    return "invalid"
  }
  setTo(some){
    const someType = YPref.getTypeof(some);
    if(someType > 0 && someType === this.#type || this.#type === 0){
      return YPref.setPrefOfType(this.#name,someType,some);
    }
    throw new Error("Can't set pref to a different type")
  }
  reset(){
    if(this.#type !== 0){
      Services.prefs.clearUserPref(this.#name)
    }
    this.#type = Services.prefs.getPrefType(this.#name);
  }
  orFallback(some){
    return this.#type > 0
      ? this.value
      : some
  }
  observe(_, topic, data) {
    if(topic !== "nsPref:changed"){
      console.warn("Somehow pref observer got topic:",topic);
      return
    }
    const newType = Services.prefs.getPrefType(this.#name);
    const needsTypeRefresh = this.#type > 0 && this.#type != newType;
    if(needsTypeRefresh){
      Services.prefs.removeObserver(this.#name,this);
    }
    this.#type = newType;
    for(let cb of this.#getObserverCallbacks()){
      try{
        cb(this)
      }catch(ex){
        console.error(ex)
      }
    }
    if(needsTypeRefresh){
      this.#observerCallbacks?.clear();
    }
  }
  forget(){
    Services.prefs.removeObserver(this.#name,this);
    this.#observerCallbacks?.clear();
  }
  #getObserverCallbacks(){
    if(!this.#observerCallbacks){
      this.#observerCallbacks = new Set();
    }
    return this.#observerCallbacks
  }
  addListener(callback){
    let callbacks = this.#getObserverCallbacks();
    if(callbacks.size === 0){
      Services.prefs.addObserver(this.#name,this);
    }
    callbacks.add(callback);
    return this
  }
  removeListener(callback){
    let callbacks = this.#getObserverCallbacks();
    callbacks.delete(callback);
    if(callbacks.size === 0){
      Services.prefs.removeObserver(this.#name,this)
    }
  }
  static fromName(some){
    return new this(some,Services.prefs.getPrefType(some))
  }
  static getPrefOfType(pref,type){
    if(type === 32)
      return Services.prefs.getStringPref(pref)
    if(type === 64)
      return Services.prefs.getIntPref(pref)
    if(type === 128)
      return Services.prefs.getBoolPref(pref);
    return null;
  }
  static getTypeof(some){
    const someType = typeof some;
    if(someType === "string")
      return 32
    if(someType === "number")
      return 64
    if(someType === "boolean")
      return 128
    return 0
  }
  static setPrefOfType(pref,type,value){
    if(type === 32)
      return Services.prefs.setCharPref(pref,value);
    if(type === 64)
      return Services.prefs.setIntPref(pref,value);
    if(type === 128)
      return Services.prefs.setBoolPref(pref,value);
    throw new Error(`Unknown pref type: {type}`);
  }
  static setIfUnset(pref,value){
    if(Services.prefs.getPrefType(pref) === 0){
      this.setPrefOfType(pref,this.getTypeof(value),value);
      return true
    }
    return false
  }
}
export function Pref(name){
  return YPref.fromName(name)
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
// This stores data we need to link from the boot.sys.mjs
export const loaderModuleLink = new (function(){
  let sessionRestored = false;
  this.setup = (ref,aVersion,aBrandName,aVariant,aSharedGlobal,aScriptData) => {
    this.scripts = ref.scripts;
    this.version = aVersion;
    this.sharedGlobal = aSharedGlobal;
    this.brandName = aBrandName;
    this.variant = aVariant;
    this.scriptDataConstructor = aScriptData;
    delete this.setup;
    Object.freeze(this);
    return
  }
  this.setSessionRestored = () => { sessionRestored = true };
  this.sessionRestored = () => sessionRestored;
  return this
})();

// _ucUtils.getScriptData() returns these types of objects
export class ScriptInfo{
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
    const ScriptData = loaderModuleLink.scriptDataConstructor;
    const headerText = ScriptData.extractHeaderText(aStringAsFSResult);
    const scriptData = new ScriptData(aName, headerText, headerText.length > aStringAsFSResult.size - 2);
    return ScriptInfo.fromScript(scriptData, false)
  }
}

export class _ucUtils{
  static get appVariant(){
    return loaderModuleLink.variant.THUNDERBIRD
    ? "Thunderbird"
    : "Firefox"
  }
  static get brandName(){
    return loaderModuleLink.brandName
  }
  static createElement(doc,tag,props,isHTML = false){
    let el = isHTML ? doc.createElement(tag) : doc.createXULElement(tag);
    for(let prop in props){
      el.setAttribute(prop,props[prop])
    }
    return el
  }
  static createWidget(desc){
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
    loaderModuleLink.sharedGlobal.widgetCallbacks.set(desc.id,desc.callback);

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
  }
  static fs = FS;
  static getScriptData(aFilter){
    const filterType = typeof aFilter;
    if(aFilter && !(filterType === "string" || filterType === "function")){
      throw "getScriptData() called with invalid filter type: "+filterType
    }
    const _ucScripts = loaderModuleLink.scripts;
    if(filterType === "string"){
      let script = _ucScripts.find(s => s.filename === aFilter);
      return script ? script.getInfo() : null;
    }
    const disabledScripts = Services.prefs.getStringPref('userChromeJS.scriptsDisabled',"").split(",");
    if(filterType === "function"){
      return _ucScripts.filter(aFilter).map(
        (script) => script.getInfo(!disabledScripts.includes(script.filename))
      );
    }
    return _ucScripts.map(
      (script) => script.getInfo(!disabledScripts.includes(script.filename))
    );
  }
  static loadURI(win,desc){
    if(loaderModuleLink.variant.THUNDERBIRD){
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
  }
  static openScriptDir(){
    return FS.getEntry("",{baseDirectory: FS.SCRIPT_DIR}).showInFileManager()
  }
  static parseStringAsScriptInfo(aName, aString){
    return ScriptInfo.fromString(aName, FS.StringContent({content: aString}))
  }
  static prefs = {
    get: (prefPath) => YPref.fromName(prefPath),
    set: (prefName, value) => YPref.fromName(prefName).setTo(value),
    setIfUnset: (prefName,value) => YPref.setIfUnset(prefName,value),
    addListener:(a,b) => {
      let o = (q,w,e)=>(b(YPref.fromName(e),e));
      Services.prefs.addObserver(a,o);
      return{pref:a,observer:o}
    },
    removeListener:(a)=>( Services.prefs.removeObserver(a.pref,a.observer) )
  }
  static registerHotkey(desc,func){
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
      
      _ucUtils.windows.forEach((doc,win) => {
        if(doc.getElementById(desc.id)){
          return
        }
        let details = { "id": desc.id, "modifiers": mods.join(",").replace("ctrl","accel"), "oncommand": "//" };
        if(key === 1){
          details.key = desc.key.toUpperCase();
        }else{
          details.keycode = `VK_${desc.key}`;
        }

        let el = _ucUtils.createElement(doc,"key",details);
        
        el.addEventListener("command",(ev) => {func(ev.target.ownerGlobal,eToO(ev))});
        let keyset = doc.getElementById("mainKeyset") || doc.body.appendChild(_ucUtils.createElement(doc,"keyset",{id:"ucKeys"}));
        keyset.insertBefore(el,keyset.firstChild);
      });
    }catch(e){
      console.error(e);
      return false
    }
    return true
  }
  static restart(clearCache){
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
  }
  static get sharedGlobal(){
    return loaderModuleLink.sharedGlobal
  }
  static async showNotification(description){
    if(loaderModuleLink.variant.THUNDERBIRD){
      console.warn('_ucUtils.showNotification is not supported on Thunderbird\nNotification label was: "'+description.label+'"');
      return
    }
    await _ucUtils.startupFinished();
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
  }
  static startupFinished(){
    return new Promise(resolve => {
      if(loaderModuleLink.sessionRestored()){
        resolve();
      }else{
        const obs_topic = loaderModuleLink.variant.FIREFOX
                    ? "sessionstore-windows-restored"
                    : "mail-delayed-startup-finished";
                    
        let observer = (subject, topic, data) => {
          Services.obs.removeObserver(observer, obs_topic);
          loaderModuleLink.setSessionRestored();
          resolve();
        };
        Services.obs.addObserver(observer, obs_topic);
      }
    });
  }
  static toggleScript(el){
    let isElement = !!el.tagName;
    if(!isElement && typeof el != "string"){
      return
    }
    const name = isElement ? el.getAttribute("filename") : el;
    let script = _ucUtils.getScriptData(name);
    if(!script){
      return null
    }
    const PREF_SCRIPTSDISABLED = 'userChromeJS.scriptsDisabled';
    const prefValue = Services.prefs.getStringPref(PREF_SCRIPTSDISABLED,"");
    const isEnabled = prefValue.indexOf(script.filename) === -1;
    if (isEnabled) {
      Services.prefs.setCharPref(PREF_SCRIPTSDISABLED, `${script.filename},${prefValue}`);
    } else {
      Services.prefs.setCharPref(PREF_SCRIPTSDISABLED, prefValue.replace(new RegExp(`^${script.filename},?|,${script.filename}`), ''));
    }
    Services.appinfo.invalidateCachesOnRestart();
    script.isEnabled = !isEnabled;
    return script
  }
  static updateStyleSheet(name = "../userChrome.css",type){
    return updateStyleSheet(name,type)
  }
  static get version(){
    return loaderModuleLink.version
  }
  static windowIsReady(win){
    if(win && win.isChromeWindow){
      return new Promise(resolve => {
        
        if(loaderModuleLink.variant.FIREFOX){
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
        const obs_topic = loaderModuleLink.variant.FIREFOX
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
  }
  static get windows(){
    return {
      get: function (onlyBrowsers = true) {
        let windowType = loaderModuleLink.variant.FIREFOX ? "navigator:browser" : "mail:3pane";
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
  }
}