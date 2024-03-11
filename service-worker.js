try {
    importScripts("dependencies/browser-polyfill.js",
                  "dependencies/utilities.js",
                  "background.js");
} catch (e) {
    console.log(e);
}