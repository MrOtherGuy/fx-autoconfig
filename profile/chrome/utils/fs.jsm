let EXPORTED_SYMBOLS = ["FileSystem"];

const Services =
  globalThis.Services ||
  ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

class FileSystem{
  static PROFILE_DIR = Services.dirsvc.get("ProfD", Ci.nsIFile).path;
  static RESULT_CONTENT = Symbol("Content");
  static RESULT_DIRECTORY = Symbol("Directory");
  static RESULT_ERROR = Symbol("Error");
  static RESULT_FILE = Symbol("File");

  static getFileURIForFile(aEntry, type){
    let qi = Services.io.getProtocolHandler('file').QueryInterface(Ci.nsIFileProtocolHandler);
    if(type === this.RESULT_DIRECTORY){
      return qi.getURLSpecFromDir(aEntry)
    }
    if(type === this.RESULT_FILE){
      return qi.getURLSpecFromActualFile(aEntry)
    }
    throw new Error("type argument must be either RESULT_FILE or RESULT_DIRECTORY")
  }

  static resolveChromePath(str){
    let parts = this.resolveChromeURL(str).split("/");
    return parts.slice(parts.indexOf("chrome") + 1,parts.length - 1).join("/");
  }
  
  static resolveChromeURL(str){
    const registry = Cc["@mozilla.org/chrome/chrome-registry;1"].getService(Ci.nsIChromeRegistry);
    try{
      return registry.convertChromeURL(Services.io.newURI(str.replace(/\\/g,"/"))).spec
    }catch(e){
      console.error(e);
      return ""
    }
  }

  static{
    this.SCRIPT_DIR = this.resolveChromePath('chrome://userscripts/content/');
    this.RESOURCE_DIR = this.resolveChromePath('chrome://userchrome/content/');
    this.BASE_FILEURI = this.getFileURIForFile(Services.dirsvc.get('UChrm',Ci.nsIFile),this.RESULT_DIRECTORY);
  }
  
  static #getEntry(aFilename, baseDirectory){
    if(typeof aFilename !== "string"){
      return FileSystemResult.fromError(new Error("Filename is not a string"))
    }
    const filename = aFilename.replace("\\","/");
    let pathParts = ((filename.startsWith("..") ? "" : baseDirectory) + "/" + filename).split("/").filter( (a) => (!!a && a != "..") );
    let entry = Services.dirsvc.get('UChrm',Ci.nsIFile);
    
    for(let part of pathParts){
      entry.append(part)
    }
    if(!entry.exists()){
      return FileSystemResult.fromError(new Error("File doesn't exist"))
    }
    return FileSystemResult.fromNsIFile(entry)
  }
  
  static getEntry(aFilename, options = {}){
    return this.#getEntry(aFilename, options.baseDirectory || this.RESOURCE_DIR)
  }
  
  static readFileSync(aFile, options = {}) {
    if(typeof aFile === "string"){
      aFile = this.#getEntry(aFile, this.RESOURCE_DIR).entry();
    }
    // aFile should now be nsIFile which might be either directory, file or not exist
    if(!aFile.isFile()){
      throw new Error("aFile is not a readable file")
    }
    let stream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
    let cvstream = Cc['@mozilla.org/intl/converter-input-stream;1'].createInstance(Ci.nsIConverterInputStream);
    try{
      stream.init(aFile, 0x01, 0, 0);
      cvstream.init(stream, 'UTF-8', 1024, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
    }catch(e){
      console.error(e);
      cvstream.close();
      stream.close();
      return FileSystemResult.fromError(new Error(`File stream initialization failed for '${aFile.leafName}`))
    }
    let rv = {content:'',path: this.getFileURIForFile(aFile,this.RESULT_FILE)};
    let data = {};
    const metaOnly = !!options.metaOnly;
    while (cvstream.readString(4096, data)) {
      rv.content += data.value;
      if (metaOnly && rv.content.indexOf('// ==/UserScript==') > 0) {
        break;
      }
    }
    cvstream.close();
    stream.close();
    
    return FileSystemResult.fromContent(rv)
  }
  static convertResourceRelativeURI(aPath){
    let base = ["chrome",this.RESOURCE_DIR];
    let parts = aPath.split(/[\\\/]/);
    while(parts[0] === ".."){
      base.pop();
      parts.shift();
    }
    let path = PathUtils.join(this.PROFILE_DIR, ...base.concat(parts));
    return path
  }
  static async readFile(aPath){
    if(typeof aPath !== "string"){
      throw "fs.readFile: path is not a string"
    }
    try{
      let path = this.convertResourceRelativeURI(aPath);
      return FileSystemResult.fromContent({ content: await IOUtils.readUTF8(path), path: PathUtils.toFileURI(path) })
    }catch(ex){
      console.error(ex)
      return FileSystemResult.fromError(ex)
    }
  }  
  static async readJSON(path){
    try{
      let result = await this.readFile(path);
      return result.isError()
            ? null
            : JSON.parse(result.content())
    }catch(ex){
      console.error(ex)
    }
    return null
  }  
  static async writeFile(path, content, options = {}){
    if(!path || typeof path !== "string"){
      throw "writeFile: path is invalid"
    }
    if(typeof content !== "string"){
      throw "writeFile: content to write must be a string"
    }

    let base = ["chrome",this.RESOURCE_DIR];
    let parts = path.split(/[\\\/]/);
    
    // Normally, this API can only write into resources directory
    // Writing outside of resources can be enabled using following pref
    const disallowUnsafeWrites = !Services.prefs.getBoolPref("userChromeJS.allowUnsafeWrites");

    while(parts[0] === ".."){
      if(disallowUnsafeWrites){
        throw "Writing outside of resources directory is not allowed"
      }
      base.pop();
      parts.shift();
    }
    const fileName = PathUtils.join( this.PROFILE_DIR, ...base.concat(parts) );
    
    if(!options.tmpPath){
      options.tmpPath = fileName + ".tmp";
    }
    return IOUtils.writeUTF8( fileName, content, options );
  }
  static createFileURI(fileName = ""){
    fileName = String(fileName);
    let u = this.resolveChromeURL(`chrome://userchrome/content/${fileName}`);
    return fileName ? u : u.substr(0,u.lastIndexOf("/") + 1); 
  }
  static chromeDir(){
    return FileSystemResult.fromDirectory(Services.dirsvc.get('UChrm',Ci.nsIFile))
  }
  static StringContent(obj){
    return FileSystemResult.fromContent(obj)
  }
}

class FileSystemResult{
  #result;
  #type;
  #fileuri;
  constructor(data,resultType){
    this.#result = data;
    this.#type = resultType;
  }
  #getFileURI(){
    if(this.isContent()){
      return this.#result.path
    }
    return FileSystem.getFileURIForFile(this.#result,this.#type)
  }
  get fileURI(){
    if(this.isError()){
      return null
    }
    if(!this.#fileuri){
      this.#fileuri = this.#getFileURI()
    }
    return this.#fileuri
  }
  content(replaceNewlines){
    if(this.isContent()){
      return replaceNewlines
          ? this.#result.content.replace(/\r\n?/g, '\n')
          : this.#result.content
    }
    throw new Error("FSResult is not fileContent but of type: "+this.#type.description)
  }
  get size(){
    return this.isContent()
          ? this.#result.content.length
          : this.#result.fileSize
  }
  entry(){
    if(this.isDirectory() || this.isFile()){
      return this.#result
    }
    throw new Error("FSResult is not a file or directory")
  }
  readSync(){
    if(!this.isFile()){
      throw new Error("Can't read: not a file")
    }
    return FileSystem.readFileSync(this.#result).content()
  }
  read(){
    if(!this.isFile()){
      return Promise.reject(new Error("Can't read: not a file"))
    }
    return IOUtils.readUTF8(this.#result.path)
  }
  get type(){
    return this.#type
  }
  isContent(){
    return this.#type === FileSystem.RESULT_CONTENT
  }
  isFile(){
    return this.#type === FileSystem.RESULT_FILE
  }
  isDirectory(){
    return this.#type === FileSystem.RESULT_DIRECTORY
  }
  isError(){
    return this.#type === FileSystem.RESULT_ERROR
  }
  [Symbol.iterator](){
    return this.entries()
  };
  entries(){
    if(!this.isDirectory()){
      throw new Error("Can't iterate - not a directory")
    }
    let enumerator = this.#result.directoryEntries.QueryInterface(Ci.nsISimpleEnumerator);
    return {
      next() {
        return enumerator.hasMoreElements()
        ? {
            value: enumerator.getNext().QueryInterface(Ci.nsIFile),
            done: false
          }
        : { done: true }
      },
      [Symbol.iterator]() {
        return this;
      },
    };
  }
  showInFileManager(){
    try{
      if(this.isFile()){
        this.#result.reveal();
        return true
      }
      if(this.isDirectory()){
        this.#result.launch();
        return true
      }
    }catch(ex){
      console.error("Could not open file manager for: " + this.#result.leafName);
    }
    return false 
  }
  static fromDirectory(dir){
    return new FileSystemResult(dir, FileSystem.RESULT_DIRECTORY)
  }
  static fromContent(content){
    return new FileSystemResult(content, FileSystem.RESULT_CONTENT)
  }
  static fromError(error){
    return new FileSystemResult(error, FileSystem.RESULT_ERROR)
  }
  static fromFile(file){
    return new FileSystemResult(file, FileSystem.RESULT_FILE)
  }
  static fromNsIFile(entry){
    if(entry.isDirectory()){
      return FileSystemResult.fromDirectory(entry)
    }else if(entry.isFile()){
      return FileSystemResult.fromFile(entry)
    }else{
      return FileSystemResult.fromError(new Error("Unknown file result"))
    }
  }
}
