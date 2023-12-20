console.log('hello');
try {
    importScripts("dependencies/browser-polyfill.js",
    "dependencies/content-scripts-register-polyfill.js",
    "dependencies/peerjs.js",
    "dependencies/reconnecting-websocket-iife.js",
    "background.js");
    console.log('does this work?');
} catch (e) {
    console.error(e);
}