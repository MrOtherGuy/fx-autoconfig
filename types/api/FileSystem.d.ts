/**
 * The FileSystemResult result object is one of four types:
 * - Filesystem.RESULT_FILE get reference to a file
 * - Filesystem.RESULT_DIRECTORY get referece to a directory
 * - Filesystem.RESULT_ERROR non-existent file or other kind of error
 * - Filesystem.RESULT_CONTENT file read operation results
 *
 * The result object has various methods to access underlying data.
 */
interface FileSystemResult {
	/**
	 * @throws if called on anything except CONTENT type.
	 */
	content(replaceNewlines: boolean): string;

	/** @returns nsIFile[] */
	entries(): any[];

	/**
	 * @throws throws if called on CONTENT or ERROR types.
	 * @returns nsIFile
	 */
	entry(): any;

	error(): any | null;
	isContent(): boolean;
	isDirectory(): boolean;
	isError(): boolean;
	isFile(): boolean;
	read(): string;
	readSync(): string;

	/**
	 * Tries to open a given file entry path in OS file manager.
	 *
	 * @returns true or false indicating success.
	 */
	showInFileManager(): boolean;

	get fileURI(): string;

	/** size of read content or size of the file on disk */
	get size(): number;

	type: any;
}

interface WriteFileOptions {
	tmpPath: boolean;
}

/**
 * Scripts should generally use the resources folder for their files. The helper
 * functions interacting with filesystem expect resources to be the root folder
 * for script operations.
 *
 * The resources folder is registered to `chrome://` scheme so scripts and
 * stylesheets can use the following URL to access files within it:
 * ```
 * "chrome://userChrome/content/<filename>.txt"
 * ```
 *
 * Scripts folder is registered to: `chrome://userScripts/content/`.
 *
 * The loader module folder is registered to `chrome://userchromejs/content/`.
 *
 * Main idea is that various methods of the FileSystem namespace return a
 * {@link FileSystemResult} object instead of the actual operation result
 * directly.
 */
interface UC_FileSystem {
	chromeDir(): FileSystemResult;
	getEntry(fileName: string): FileSystemResult;
	readFile(fileName: string): Promise<FileSystemResult>;
	readFileSync(some: string | nsIFile): FileSystemResult;

	/**
	 * Asynchronously try to read a file and parse it as json.
	 * If file can't be parsed then returns `null`.
	 */
	readJSON(fileName: string): Promise<object | null>;

	/**
	 * Write the content into file *as UTF8*.
	 *
	 * By default writing files using this API is only allowed in resources
	 * directory. Calling writeFile with fileName like `"../test.txt"` will then
	 * reject the promise. You must set pref userChromeJS.allowUnsafeWrites to
	 * true to allow writing outside of resources.
	 *
	 * @param fileName
	 * @param content
	 * @param options currently only used to pass a filename for temp file.
	 * By default it is derived from fileName.
	 * @returns the number of written bytes.
	 *
	 * @note Currently this method replaces the existing file if one exists.
	 */
	writeFile(
		fileName: string,
		content: string,
		options: WriteFileOptions,
	): Promise<number>;
}
