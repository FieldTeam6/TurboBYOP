try {
    importScripts("dependencies/browser-polyfill.js",
                  "background.js");
} catch (e) {
    console.log(e);
}