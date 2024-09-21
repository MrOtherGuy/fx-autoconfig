interface NotificationDetails {
	label: string;
	type?: string;

	/**
	 * Defines the ordering and coloring of this notification.
	 *
	 * Notifications of higher priority are shown before those of lower priority.
	 *
	 * Defaults to `info`.
	 */
	priority?: "system" | "critical" | "warning" | "info";

	/**
	 * If exists, then the notification will be shown in that window.
	 * Otherwise it is shown in the last active window.
	 */
	window?: Window;

	/**
	 * If exists then the notification will be shown in that tab only.
	 * Otherwise the notification is global to the window.
	 */
	tab?: Element;

	/**
	 * @see https://searchfox.org/mozilla-central/rev/3f782c2587124923a37c750b88c5a40108077057/toolkit/content/widgets/notificationbox.js#113
	 */
	buttons?: any[];

	/**
	 * @see https://searchfox.org/mozilla-central/rev/3f782c2587124923a37c750b88c5a40108077057/toolkit/content/widgets/notificationbox.js#95
	 */
	callback?: (event: string) => void;
}

/**
 * Display and receive input to and from browser notification toolbar
 * (not to be confused with OS notification system).
 */
interface Notifications {
	show(def: NotificationDetails): Promise<void>;
}
