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

declare module "chrome://userchromejs/content/uc_api.sys.mjs" {
	export const FileSystem: UC_FileSystem;
	export const Hotkeys: Hotkeys;
	export const Notifications: Notifications;
	export const Prefs: Prefs;
	export const Runtime: Runtime;
	export const Scripts: Scripts;
	export const Utils: Utils;
	export const Windows: Windows;
}

export type {};
