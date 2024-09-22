/// <reference types="./api/FileSystem.d.ts" />
/// <reference types="./api/Hotkeys.d.ts" />
/// <reference types="./api/Notifications.d.ts" />
/// <reference types="./api/Prefs.d.ts" />
/// <reference types="./api/Runtime.d.ts" />
/// <reference types="./api/Scripts.d.ts" />
/// <reference types="./api/Utils.d.ts" />
/// <reference types="./api/Windows.d.ts" />

declare global {
	const UC_API: {
		FileSystem: UC_FileSystem;
		Hotkeys: Hotkeys;
		Notifications: Notifications;
		Prefs: Prefs;
		Runtime: Runtime;
		Scripts: Scripts;
		Utils: Utils;
		Windows: Windows;
	};
}

export type {};
