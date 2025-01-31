interface HotkeyDetails {
	id: string;
	modifiers: string;
	key: string;

	/**
	 * If command is a function then a new `<command>` element will be created
	 * for it with an id attribute derived from the specified id.
	 *
	 * If command is a string then the hotkey will simply invoke a command
	 * matching that string - either a built-in command name or an id of the
	 * to-be-invoked.
	 */
	command: ((window: Window, commandEvent: any) => void) | string;
}

interface HotkeyOptions {
	suppressOriginal: boolean;
}

interface Hotkey {
	command: any;
	matchingSelector: string;
	trigger: any;
	attachToWindow(window: Window, opts?: HotkeyOptions): Promise<void>;
	autoAttach(opts?: HotkeyOptions): Promise<void>;
	restoreOriginalKey(window: Window): void;
	suppressOriginalKey(window: Window): void;
}

interface Hotkeys {
	/**
	 * @note This simply creates a definition for the hotkey, but it does not
	 * add it to any window. The {@link Hotkey} instance will have methods you
	 * can use to do that.
	 */
	define(details: HotkeyDetails): Hotkey;
}
