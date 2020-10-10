// ==UserScript==
// @name           userChrome_as_css_module.uc.js
// @namespace      userChrome_Agent_Sheet_CSS_module
// @version        0.0.5
// @note           Load userChrome.as.css file as agent sheet
// @backgroundmodule
// ==/UserScript==

let EXPORTED_SYMBOLS = [];
(function () {
  const {Services} = ChromeUtils.import('resource://gre/modules/Services.jsm');
	let sss = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
  const path = Services.io.getProtocolHandler('file').QueryInterface(Ci.nsIFileProtocolHandler).getURLSpecFromDir(Services.dirsvc.get('UChrm',Ci.nsIFile));
  try{
    sss.loadAndRegisterSheet(Services.io.newURI(path + "userChrome.as.css"), sss.AGENT_SHEET);
  }catch(e){
    console.error(`Could not load userChrome.as.css: ${e.name}`)
  }
})();