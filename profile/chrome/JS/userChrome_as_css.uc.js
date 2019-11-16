// ==UserScript==
// @name           userChrome_as_css.uc.js
// @namespace      userChrome_Agent_Sheet_CSS
// @version        0.0.4
// @note           Load userChrome.as.css file as agent sheet
// ==/UserScript==

(function () {

	let sss = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
  const path = _ucUtils.chromeDir.uri + 'userChrome.as.css';
  
  sss.loadAndRegisterSheet(makeURI(path), sss.AGENT_SHEET);
})();