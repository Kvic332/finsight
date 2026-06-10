// Module-level flags shared across the JS bundle.
// Using a plain module (not React context) so native event handlers in App.js
// can read the flag synchronously without needing component access.

let _pickingMedia = false;

/** Call BEFORE opening any system picker that backgrounds the app. */
export const setPickingMedia = (val) => { _pickingMedia = !!val; };

/** Returns true while a system picker (image, file, etc.) is open. */
export const isPickingMedia = () => _pickingMedia;
