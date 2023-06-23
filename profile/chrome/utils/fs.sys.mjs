export class FileSystem{
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
    throw ResultError.fromKind(this.ERROR_KIND_INVALID_ARGUMENT,{expected: "FileSystem.RESULT_FILE | FileSystem.RESULT_DIRECTORY"})
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
      return FileSystemResult.fromErrorKind(FileSystem.ERROR_KIND_INVALID_ARGUMENT,"String");
    }
    const filename = aFilename.replace("\\","/");
    let pathParts = ((filename.startsWith("..") ? "" : baseDirectory) + "/" + filename).split("/").filter( (a) => (!!a && a != "..") );
    let entry = Services.dirsvc.get('UChrm',Ci.nsIFile);
    
    for(let part of pathParts){
      entry.append(part)
    }
    if(!entry.exists()){
      return FileSystemResult.fromErrorKind(FileSystem.ERROR_KIND_NOT_EXIST)
    }
    return FileSystemResult.fromNsIFile(entry)
  }
  
  static getEntry(aFilename, options = {}){
    return this.#getEntry(aFilename, options.baseDirectory || this.RESOURCE_DIR)
  }
  
  static readFileSync(aFile, options = {}) {
    if(typeof aFile === "string"){
      const fsResult = this.#getEntry(aFile, this.RESOURCE_DIR);
      if(fsResult.isError()){
        return fsResult
      }
      if(fsResult.isFile()){
        aFile = fsResult.entry();
      }else{
        return FileSystemResult.fromErrorKind(this.ERROR_KIND_NOT_FILE)
      }
    }else if(!(aFile instanceof Ci.nsIFile && aFile.exists() && aFile.isFile())){
      return FileSystemResult.fromErrorKind(this.ERROR_KIND_NOT_FILE)
    }
    // aFile should now be nsIFile mapping to a file
    let stream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
    let cvstream = Cc['@mozilla.org/intl/converter-input-stream;1'].createInstance(Ci.nsIConverterInputStream);
    try{
      stream.init(aFile, 0x01, 0, 0);
      cvstream.init(stream, 'UTF-8', 1024, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
    }catch(e){
      console.error(e);
      cvstream.close();
      stream.close();
      return FileSystemResult.fromError(this.ERROR_KIND_NOT_READABLE,{cause: e},{filename: aFile.leafName})
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
      throw ResultError.fromKind(this.ERROR_KIND_INVALID_ARGUMENT,{expected: "string"})
    }
    try{
      let path = this.convertResourceRelativeURI(aPath);
      return FileSystemResult.fromContent({ content: await IOUtils.readUTF8(path), path: PathUtils.toFileURI(path) })
    }catch(ex){
      console.error(ex)
      return FileSystemResult.fromError(this.ERROR_KIND_NOT_READABLE,{cause: ex})
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
      throw ResultError.fromKind(this.ERROR_KIND_INVALID_ARGUMENT,{expected: "string"})
    }
    if(typeof content !== "string"){
      throw ResultError.fromKind(this.ERROR_KIND_INVALID_ARGUMENT,{expected: "string"})
    }

    let base = ["chrome",this.RESOURCE_DIR];
    let parts = path.split(/[\\\/]/);
    
    // Normally, this API can only write into resources directory
    // Writing outside of resources can be enabled using following pref
    const disallowUnsafeWrites = !Services.prefs.getBoolPref("userChromeJS.allowUnsafeWrites");

    while(parts[0] === ".."){
      if(disallowUnsafeWrites){
        throw ResultError.fromKind(this.ERROR_KIND_NOT_ALLOWED)
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
  static ERROR_KIND_NOT_EXIST = 1;
  static ERROR_KIND_NOT_DIRECTORY = 2;
  static ERROR_KIND_NOT_FILE = 3;
  static ERROR_KIND_NOT_CONTENT = 4;
  static ERROR_KIND_UNKNOWN_RESULT = 5;
  static ERROR_KIND_INVALID_ARGUMENT = 6;
  static ERROR_KIND_NOT_READABLE = 7;
  static ERROR_KIDN_NOT_ALLOWED = 8;
}

class ResultError extends Error{
  
  constructor(kind,options,info = {}){
    super(ResultError.toMessage(kind,info),options);
    this.kind = kind;
    this.name = "ResultError";
  }
  static toMessage(kind,info){
    switch(kind){
      case FileSystem.ERROR_KIND_NOT_EXIST:
        return "Entry doesn't exist"
      case FileSystem.ERROR_KIND_NOT_DIRECTORY:
        return "Result is not a directory"
      case FileSystem.ERROR_KIND_NOT_FILE:
        return "Result is not a file"
      case FileSystem.ERROR_KIND_NOT_CONTENT:
        return "Result is not content"
      case FileSystem.ERROR_KIND_UNKNOWN_RESULT:
        return "Unknown result type: " + this.parseInfo(info)
      case FileSystem.ERROR_KIND_INVALID_ARGUMENT:
        return "Invalid argument: " + this.parseInfo(info)
      case FileSystem.ERROR_KIND_NOT_READABLE:
        return "File stream is not readable: " + this.parseInfo(info)
      case FileSystem.ERROR_KIND_NOT_ALLOWED:
        return "Writing outside of resources directory is not allowed"
      default:
        return "Unknown error"
    }
  }
  static parseInfo(aInfo){
    return Object.entries(aInfo).map(a => `${a[0]}: ${a[1]}`).join("; ")
  }
  static fromKind(aKind,info){
    return new ResultError(aKind,{},info)
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
  
  get fileURI(){
    if(this.isError()){
      return null
    }
    if(!this.#fileuri){
      this.#fileuri = FileSystemResult.#getFileURI(this)
    }
    return this.#fileuri
  }
  content(replaceNewlines){
    if(this.isContent()){
      return replaceNewlines
          ? this.#result.content.replace(/\r\n?/g, '\n')
          : this.#result.content
    }
    throw ResultError.fromKind(FileSystem.ERROR_KIND_NOT_CONTENT,this.#type.description)
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
    throw ResultError.fromKind(FileSystem.ERROR_KIND_NOT_EXIST)
  }
  error(){
    return this.isError()
          ? this.#result
          : null
  }
  readSync(){
    if(!this.isFile()){
      throw ResultError.fromKind(FileSystem.ERROR_KIND_NOT_FILE)
    }
    return FileSystem.readFileSync(this.#result).content()
  }
  read(){
    if(!this.isFile()){
      return Promise.reject(ResultError.fromKind(FileSystem.ERROR_KIND_NOT_FILE))
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
      throw ResultError.fromKind(FileSystem.ERROR_KIND_NOT_DIRECTORY)
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
  static #getFileURI(aResult){
    if(aResult.isContent()){
      return aResult.#result.path
    }
    return FileSystem.getFileURIForFile(aResult.#result,aResult.#type)
  }
  static fromDirectory(dir){
    return new FileSystemResult(dir, FileSystem.RESULT_DIRECTORY)
  }
  static fromContent(content){
    return new FileSystemResult(content, FileSystem.RESULT_CONTENT)
  }
  static fromError(aKind,aErrorDescription){
    return new FileSystemResult(new ResultError(aKind, aErrorDescription), FileSystem.RESULT_ERROR)
  }
  static fromErrorKind(aKind){
    return new FileSystemResult(ResultError.fromKind(aKind), FileSystem.RESULT_ERROR)
  }
  static fromFile(file){
    return new FileSystemResult(file, FileSystem.RESULT_FILE)
  }
  static fromNsIFile(entry){
    if(entry.isDirectory()){
      return FileSystemResult.fromDirectory(entry)
    }else if(entry.isFile()){
      return FileSystemResult.fromFile(entry)
    }
    return FileSystemResult.fromError(ResultError.fromKind(FileSystem.ERROR_KIND_UNKNOWN_RESULT))
  }
}
