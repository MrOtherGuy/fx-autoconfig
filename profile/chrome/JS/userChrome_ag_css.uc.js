// ==UserScript==
// @name           userChrome_ag_css_module.uc.js
// @namespace      userChrome_Agent_Sheet_CSS_module
// @version        0.0.6
// @description    Load userChrome.ag.css from resources as agent sheet. The file is loaded from resources folder using chrome: uri
// @backgroundmodule
// ==/UserScript==

let EXPORTED_SYMBOLS = [];
(function () {
  const {Services} = ChromeUtils.import('resource://gre/modules/Services.jsm');
	let sss = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
  
  // Try to load userChrome.ag.css as agent sheet
  // WARNING - agent sheets affect each and every document you load including web sites. So be careful with your custom styles.
  
  try{
    sss.loadAndRegisterSheet(Services.io.newURI("chrome://userChrome/content/userChrome.ag.css"), sss.AGENT_SHEET);
  }catch(e){
    console.error(`Could not load userChrome.ag.css: ${e.name}`)
  }
})();