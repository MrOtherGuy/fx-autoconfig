/**
 * Namespace to interact with windows.
 */
interface Windows {
	/**
	 * Runs the specified function for each window.
	 *
	 * @param onlyBrowsers If `false`, `UC_API` may not be available
	 * on all target window objects. The callback function should check
	 * for it's availability when called that way.
	 */
	forEach(
		callback: (document: Document, window: Window) => void,
		onlyBrowsers: boolean,
	): void;

	/**
	 * @param onlyBrowsers If `true`, then this only includes browser
	 * windows. If it's `false` then it also includes consoles, PiP,
	 * non-native notifications etc. Defaults to `true`.
	 *
	 * @returns a list of handles for each window object for this
	 * Firefox instance.
	 */
	getAll(onlyBrowsers: boolean): Window[];

	/**
	 * @returns the last focused window. If `windowType` is undefined,
	 * then returns `navigator:browser` window (eg. main browser window)
	 * on Firefox or `mail:3pane` window on Thunderbird.
	 */
	getLastFocused(windowType?: string): Window;

	/**
	 * @returns a boolean indicating if the argument window is a main
	 * browser window.
	 */
	isBrowserWindow(window: Window): boolean;

	/**
	 * Registers the `callback` function to be called when a new window
	 * has been opened. The callback is executed on `DOMContentLoaded` event.
	 *
	 * Perhaps not useful for normal scripts, but can be an easy way for a
	 * background-script to do work when window is created.
	 */
	onCreated(callback: (window: Window) => void): void;

	/**
	 * @returns a Promise which resolves when it has finished its
	 * initialization work.
	 *
	 * Scripts are normally injected on `DOMContentLoaded` event,
	 * but lots of initialization has not happened yet.
	 */
	waitWindowLoading(window: Window): Promise<Window>;
}
