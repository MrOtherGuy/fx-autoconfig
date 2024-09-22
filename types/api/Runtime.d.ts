/**
 * Provides general information about the loader and state of the browser.
 */
interface Runtime {
	appVariant: "Firefox" | "Thunderbird";

	/**
	 * Brand name of the browser eg. "Firefox", "Firefox Nightly" etc.
	 */
	brandName: string;

	/**
	 * Perhaps to be used in the future.
	 */
	config: null;

	/**
	 * The version string of `boot.sys.mjs`.
	 */
	loaderVersion: string;

	/**
	 * Immediately restart the browser. A closing prompt is shown if some
	 * other part of the browser such as a website would need a confirmation
	 * about restart.
	 *
	 * @param clearCache If `true`, then Firefox will invalidate startupCache
	 * which allows changes to the enabled scripts to take effect.
	 */
	restart(clearCache: boolean): void;

	/**
	 * @returns a promise that will be resolved when all windows have been
	 * restored during session startup. If all windows have already been
	 * restored at the time of calling the promise will be resolved immediately.
	 */
	startupFinished(): Promise<void>;
}
