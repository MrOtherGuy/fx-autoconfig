interface LoadURIDetails {
	url: string;
	where: "current" | "tab" | "tabshifted" | "window";
	private?: boolean;
	userContextId?: number;
}

interface WidgetDetails {
	id: string;
	type: string;
	label?: string;
	tooltip?: string;

	/**
	 * By default `toolbarbutton-1 chromeclass-toolbar-additional` and the
	 * value of the class property (when provided) will be added into that.
	 */
	class?: string;

	/**
	 * Loaded from `resources` folder so save your icon files there.
	 */
	image?: string;

	/**
	 * Inline style to all elements of that widget.
	 * The image will be loaded as centered background-image
	 * in toolbaritems and as list-style-image in toolbarbuttons.
	 */
	style?: string;

	/**
	 * Defines if the callback should be called for all clicks,
	 * not just left-clicks.
	 */
	allEvents?: boolean;

	/**
	 * Will be stored in `UC_API.sharedGlobal` mapped to the provided id.
	 *
	 * @param event
	 * @param win reference to the window object where that instance of the widget is.
	 */
	callback?: (event: Event, win: Window) => void;
}

/**
 * Widget is a wrapper for actual elements. Firefox tracks
 * widget placements across windows meaning that you can
 * create the widget once and then you can re-position it
 * using customize mode and its new location will be shared
 * in all windows. The wrapper contains information about the
 * instances of that widget in windows.
 */
type WidgetWrapper = any;

/**
 * Few DOM manipulation helpers for creating elements, etc.
 */
interface Utils {
	/**
	 * Attaches a new element with `tagname` to the given
	 * `document` and adds its attributes from attributes object.
	 *
	 * @param isHTML whether the element is XUL element or HTML element - defaults to false.
	 */
	createElement(
		document: Document,
		tagname: string,
		attributes: Record<string, string>,
		isHTML: boolean,
	): Element;

	/**
	 * @note Any keys in {@link WidgetDetails} that are not
	 * mentioned are added to the created element as attributes.
	 *
	 * @throws if {@link WidgetDetails.id} is not provided.
	 * @throws if {@link WidgetDetails.type} is anything except
	 * `toolbaritem` or `toolbarbutton`.
	 * @throws if a widget with same id already exists. For
	 * example if a script which calls this method is executed
	 * in multiple Firefox windows then the first one should
	 * succeed, but successive calls should throw an Error.
	 *
	 * @returns this class https://searchfox.org/mozilla-central/source/browser/components/customizableui/CustomizableUI.sys.mjs#5991 (or `WidgetGroupWrapper` if outdated).
	 */
	createWidget(details: WidgetDetails): WidgetWrapper;

	/**
	 * Escapes XUL markup in case you need to add strings to the UI.
	 */
	escapeXUL(markup: string): string;

	/**
	 * @returns a boolean indicating if the operation was successful.
	 */
	loadURI(win: Window, desc: LoadURIDetails): boolean;
}
