// ==UserScript==
// @name           userChrome_author_css
// @namespace      userChrome_Author_Sheet_CSS
// @version        0.0.5
// @description    Load userChrome.au.css file as author sheet from resources folder using chrome: uri
// @onlyonce
// ==/UserScript==

(function () {

	let sss = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
  
  // Try to load userChrome.au.css as author sheet
  // WARNING - author sheets loaded like this affect each and every document you load including web sites. So be careful with your custom styles.
  
  try{
    sss.loadAndRegisterSheet(makeURI("chrome://userChrome/content/userChrome.au.css"), sss.AUTHOR_SHEET);
  }catch(e){
    console.error(`Could not load userChrome.au.css: ${e.name}`)
  }
})();