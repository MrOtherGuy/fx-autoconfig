type PrefValue = number | string | boolean;

interface Pref {
	name: string;
	type: "string" | "boolean" | "number" | "invalid";
	value: PrefValue | null;
	exists(): boolean;
	hasUserValue(): boolean;
	reset(): void;
}

interface PrefListener {
	// copied from lib.gecko.xpcom.d.ts
	observer(aDomain: string, aObserver: any, aHoldWeak?: boolean): void;
	pref: string;
}

/**
 * A shortcut for reading and writing preferences
 */
interface Prefs {
	/**
	 * @returns a representation of the pref wrapped into an object with
	 * properties.
	 */
	get(name: string): Pref;

	/**
	 * @throws if you try to set a pref to a value of different type than what
	 * it currently is (ie. boolean vs. string) unless the pref doesn't exist
	 * when this is called.
	 * @throws if you try to set the pref with value that is not one of number,
	 * string, boolean - number is also converted to integer.
	 */
	set(name: string, value: PrefValue): void;

	/**
	 * The callback will be invoked when any pref that starts with
	 * `name` is changed.
	 */
	addListener(
		name: string,
		callback: (value: PrefValue, pref: Pref) => void,
	): PrefListener;

	removeListener(listener: PrefListener): void;
}
