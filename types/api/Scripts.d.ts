interface ScriptInfo {
	/**
	 * @returns nsIFile
	 */
	asFile(): any;
	author: string | undefined;
	charset: string | undefined;
	chromeURI: string | undefined;
	description: string | undefined;
	downloadURL: string | undefined;
	string: string | undefined;
	filename: string | undefined;
	homepageURL: string | undefined;
	icon: string | undefined;
	id: string | undefined;
	ignoreCache: boolean;
	inbackground: boolean;
	injectionFailed: boolean;
	isESM: boolean;
	isEnabled: boolean;
	isRunning: boolean;
	loadOrder: number;
	manifest: string | undefined;
	name: string | undefined;
	noExec: boolean;
	onlyonce: boolean;
	optionsURL: string | undefined;
	referenceURI: string;
	regex: RegExp | null;
	styleSheetMode: any | null;
	type: string;
	updateURL: string | undefined;
	useFileURI: boolean;
	version: string;
}

/**
 * Provide information about registered scripts and styles and some
 * controls for them.
 */
interface Scripts {
	getScriptData(filter?: (data: ScriptInfo) => void): ScriptInfo[];
	getScriptData(name: string): ScriptInfo | null;
	getStyleData(filter?: (data: ScriptInfo) => void): ScriptInfo[];
	getStyleData(name: string): ScriptInfo | null;

	/**
	 * Returns the `<menu>` element created for controlling scripts.
	 * In Firefox this is inside "Menubar > Tools".
	 *
	 * @note The menu is lazily generated and calling this method should cause
	 * it to be generated if it isn't already.
	 */
	getScriptMenuForDocument(doc: Document): Element;

	/**
	 * Tries to open your script directory in OS file manager.
	 *
	 * @returns true or false indicating success.
	 * @note Whether this works or not probably depends on your OS.
	 * Only tested on Windows 10.
	 */
	openScriptDir(): void;

	/**
	 * Tries to open your style directory in OS file manager.
	 *
	 * @returns true or false indicating success.
	 * @note Whether this works or not probably depends on your OS.
	 * Only tested on Windows 10.
	 */
	openStyleDir(): void;

	/**
	 * This can be used to construct a {@link ScriptInfo} object from arbitrary
	 * string following the same logic the loader uses internally.
	 *
	 * @param aName When given as "filename", the `aString` is parsed just like
	 * script metadata block in your files.
	 * @param aString
	 * @param parseAsStyle When truthy, makes the method parse `aString`
	 * as style instead of a script.
	 *
	 * @note There needs to be a new-line after the closing `// ==/UserScript==`
	 * "tag" for the metadata to be parsed correctly.
	 */
	parseStringAsScriptInfo(
		aName: string,
		aString: string,
		parseAsStyle: boolean,
	): ScriptInfo;

	/**
	 * Toggles the specified script, note that browser restart is required for
	 * changes to take effect.
	 */
	toggleScript(fileName: string): ScriptInfo;

	/**
	 * @param name Relative to resources folder, but you can use `../` prefix
	 * to get back to chrome folder.
	 * @param sheet_mode
	 * @returns a boolean indicateing whether a style file with specified name
	 * was found in the corresponding list.
	 *
	 * @note You can't reload a style that is in one sheet-mode list into another
	 * sheet-mode. Such as, you cannot use this to reload userChrome.css into
	 * agent-mode list.
	 * @note If the specified stylesheet imports other files, then calling this
	 * will also reload any of those imported files. However, in experience it
	 * might be that reload of imported stylesheets does not take effect until a
	 * new window is created.
	 */
	reloadStyleSheet(name?: string, sheet_mode?: "agent" | "author"): boolean;
}
