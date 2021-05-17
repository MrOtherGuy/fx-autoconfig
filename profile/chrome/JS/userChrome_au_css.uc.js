// ==UserScript==
// @name           userChrome_au_css.uc.js
// @namespace      userChrome_Agent_Sheet_CSS
// @version        0.0.5
// @description    Load userChrome.au.css file as author sheet into the document that loads this script. The file is loaded from resources folder using chrome: uri
// @onlyonce
// ==/UserScript==

(function () {

	let sss = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
  try{
    sss.loadAndRegisterSheet(makeURI("chrome://userChrome/content/userChrome.au.css"), sss.AUTHOR_SHEET);
  }catch(e){
    console.error(`Could not load userChrome.au.css: ${e.name}`)
  }
})();