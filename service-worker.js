try {
    importScripts("dependencies/browser-polyfill.js",
                  "dependencies/content-scripts-register-polyfill.js",
                  "background.js");
} catch (e) {
    console.log(e);
}