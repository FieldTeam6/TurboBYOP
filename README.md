# Field Team 6 BYOP Extension

## Source Code

- [background.js](./background.js) - the [background script](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Anatomy_of_a_WebExtension#Background_scripts)
- [popup.html](./popup.html) and [options.html](./options.html) are the toolbar popup and extension options pages
- [openvpb.js](./openvpb.js) contains platform-specific code for interacting with the phone bank pages

## Dependencies
- [WebExtension Polyfill](https://github.com/mozilla/webextension-polyfill) - wraps Chrome-specific browser APIs with the WebExtension standard interfaces