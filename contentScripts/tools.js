/**
 * removes all non-numeric characters from the number string
 * @param  {string}   number i.e. +1 (223) 456-7890
 * @return {string}         i.e. 2234567890
 */
function formatNumber(number) {
    var simplifiedNumber = number.trim().replace(/\D/g, '');
    // remove international code for US numbers
    if (simplifiedNumber.length === 11 && simplifiedNumber.charAt(0) === '1') {
        simplifiedNumber = simplifiedNumber.substr(1);
    }
    return simplifiedNumber;
}

function getFunctionName(func) {
    return func.name.replace(/bound /g, '');
}

/**
 * continually calls the given method until successful
 * @param {Function}   method         should return true when successful, or false when we should give up early
 * @param {bool}       silenceErrors  true if we should not alert on errors
 * @param {Function}   cb             to be called with the results from method when we're done trying
 */
function keepTrying(method, silenceErrors, cb) {
    const frequency = 100; // try every 100ms
    let tryCount = 2 * 1000 / frequency; // keep trying for 2 seconds
    var keepTryingInterval = setInterval(function () {
        var successful = method();
        var giveUp = successful === false || tryCount-- < 0;
        if (successful === true || giveUp) {
            clearInterval(keepTryingInterval);
            // the app failed
            if (!silenceErrors && giveUp) {
                if (siteIsGoogleVoice) {
                    if (getFunctionName(method) == 'confirmSent') {
                        showFatalError(`If the problem persists, please wait 24 hours and try again.\n\nError: "${getFunctionName(method)}" failed.`, true)
                    } else {
                        showFatalError(`If the problem persists, please report the error in the BYOP Slack channel or via the help link in the extension popup.\n\nError: "${getFunctionName(method)}" failed.`, true);
                    }
                } else {
                    showFatalError('Are you sure Google Voice texting via Hangouts is enabled?\nAlso, be aware that this extension is not compatible with the Google Hangouts Chrome extension. If you have the Hangouts extension installed you\'ll need to temporarily disable it.', false);
                }
            }
            if (cb) {
                cb(successful);
            }
        }
    }, frequency);
}

/**
 * continually calls the given method until successful
 * Promisified for use with async/await
 * @param {Function}   method         should return true when successful, or false when we should give up early
 * @param {bool}       silenceErrors  true if we should not alert on errors
 * @param {Function}   cb             to be called with the results from method when we're done trying
 */
function keepTryingAsPromised(method, silenceErrors) {
    console.log('BYOP SMS - Running: ', getFunctionName(method));
    const waitTime = 400; // 400ms
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            keepTrying(method, silenceErrors, (successful) => {
                resolve(successful);
            });
        }, waitTime);
    });
}

/**
 * shows the message as an alert, reloads the page if instructed to
 * @param {*} message
 * @param {*} reload
 */
function showFatalError(message, reload) {
    if (siteManager) {
        siteManager.messagesToSend.length = 0;
    }
    const manifest = chrome.runtime.getManifest();
    const reloadMessage = '\n\nWhen you click "OK" the page will refresh.';
    const fullMessage = `BYOP v${manifest.version}:\nText failed. ${message} ${reload ? reloadMessage : ''}`;
    console.error('BYOP SMS - ' + fullMessage);
    alert(fullMessage);
    if (reload) {
        window.location.reload();
    }
}

/**
 * Removes unicode characters from the text
 */
function removeUnicode(text) {
    return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
}

/**
 * Removes whitespace from the text
 */
function removeWhitespace(text) {
    return text.replace(/\s/g, '');
}

const simulateKeyPress = (element) => {
    element.dispatchEvent(new Event('change', {
        bubbles: true,
        cancelable: true
    }));
}

function simulateTextEntry(inputField, textToEnter) {
    inputField.focus();
    inputField.value = "";

    for (let i = 0; i < textToEnter.length; i++) {
        var charCode = textToEnter.charCodeAt(i);

        let keydownEvent = new Event('keydown', { keyCode: charCode });
        inputField.dispatchEvent(keydownEvent);

        let keypressEvent = new Event('keypress', { keyCode: charCode });
        inputField.dispatchEvent(keypressEvent);

        inputField.value = inputField.value + textToEnter[i];

        let inputEvent = new Event('input', { bubbles: true });
        inputField.dispatchEvent(inputEvent);

        let keyupEvent = new Event('keyup', { keyCode: charCode });
        inputField.dispatchEvent(keyupEvent);
    }
}
