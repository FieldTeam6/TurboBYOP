const gvUrl = 'https://voice.google.com/u/0/messages';
const tfUrl = 'https://messages.textfree.us/conversation/'
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

function titleCase(str) {
    //first check if name contains both capital and lowercase letters, if so send back as-is
    if(!str || (/[A-Z]/.test(str) && /[a-z]/.test(str))){
      return str;
    }
    //Capitalize the initial first letter, lowercase the rest
    str = str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    //Capitalize every letter after a space, hyphen or apostrophe and return
    return str.replace(/(?<=[ \-'])[^ \-']*/g, function(txt){
        return txt.charAt(0).toUpperCase() + txt.substr(1);
    });
}

function getFunctionName(func) {
    return func.name.replace(/bound /g, '');
}

/**
 * continually calls the given method until successful
 * @param {Function}   method         should return true when successful, or false when we should give up early
 * @param {bool}       silenceErrors  true until we exhaust all retries
 * @param {Function}   callback       to be called with the results from method when we're done trying
 */
function keepTrying(method, silenceErrors, callback) {
    const frequency = 50; // try every 50ms
    let tryCount = (2 * 1000) / frequency; // keep trying for 1 seconds
    var keepTryingInterval = setInterval(function () {
        let functionName = getFunctionName(method);
        // Get return value from current method
        var successful = method();

        if (functionName === 'confirmMessageFailedToSend') {
            if (successful) {
                // In this particular case, the appearance of the 
                // selector indicates failure, and we should abort
                successful = false;
            } else if (tryCount < 0) {
                // If all retries have been exhausted and an error message 
                // has not yet appeared, consider text successfully sent
                successful = true;
            }
        }

        var giveUp = successful === false || (tryCount-- < 0 && functionName !== 'confirmMessageFailedToSend');

        if (successful === true || giveUp) {
            if (functionName === 'confirmSent' || functionName === 'confirmMessageFailedToSend') {
                // If error occurs on confirmSent or confirmMessageFailedToSend, it is almost 
                // always indicative to throttling, and we want to abort immediately
                silenceErrors = false;
            }

            clearInterval(keepTryingInterval);
            // the app failed
            if (!silenceErrors && giveUp) {
                if (siteIsGoogleVoice) {
                    if (functionName === 'confirmSent' || functionName === 'confirmMessageFailedToSend') {
                        showFatalError(
                            `You've been throttled by Google Voice.  Please try a different campaign, or wait 24 hours and try again.\n\nError: "${functionName}" failed.`,
                            true
                        );
                    } else {
                        showFatalError(
                            `If the problem persists, please report the error in the BYOP Slack channel or via the help link in the extension popup.\n\nError: "${functionName}" failed.`,
                            true
                        );
                    }
                } else {
                    showFatalError(
                        "Are you sure Google Voice texting via Hangouts is enabled?\nAlso, be aware that this extension is not compatible with the Google Hangouts Chrome extension. If you have the Hangouts extension installed you'll need to temporarily disable it.",
                        false
                    );
                }
            }
            if (callback) {
                callback(successful);
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
    const waitTime = 100; // 100ms
    return new Promise((resolve, reject) => {
        keepTrying(method, silenceErrors, (successful) => {
            resolve(successful);
        });
    });
}

/**
 * shows the message as an alert, reloads the page if instructed to
 * @param {*} message
 * @param {*} reload
 */
function showFatalError(message, reload) {
    if (typeof siteManager !== 'undefined' && siteManager) {
        siteManager.messagesToSend.length = 0;
    }
    // Re-enable Set Up Text Message button
    browser.runtime.sendMessage({
        type: 'TALK_TO_TAB',
        url: 'https://www.openvpb.com/VirtualPhoneBank*',
        tabType: 'SENDING_ERROR'
    });
    const manifest = browser.runtime.getManifest();
    const reloadMessage = '\n\nWhen you click "OK" the page will refresh.';
    const fullMessage = `BYOP v${manifest.version}: Text failed.\n\n${message} ${reload ? reloadMessage : ''}`;
    console.error('BYOP SMS - ' + fullMessage);
    alert(fullMessage);
    if (reload) {
        console.log('reloading page');
        window.location.reload();
    }
}

/**
 * Removes unicode characters from the text
 */
function removeUnicode(text) {
    return text.replace(
        /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
        ''
    );
}

/**
 * Removes whitespace from the text
 */
function removeWhitespace(text) {
    return text.replace(/\s/g, '');
}

function sanitizeText(text) {
    return removeWhitespace(removeUnicode(text));
}

const simulateReturnKeyPress = (element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); // only works with keydown
};

const simulateInputChange = (element) => {
    element.dispatchEvent(
        new KeyboardEvent('input', {
            bubbles: true,
            cancelable: true
        })
    );
};

const simulateKeyPress = (element) => {
    element.dispatchEvent(
        new Event('change', {
            bubbles: true,
            cancelable: true
        })
    );
};

function simulateTextEntry(inputField, textToEnter) {
    inputField.focus();
    let inputFieldValueProp = inputField.value !== undefined ? 'value' : 'innerText';
    inputField[inputFieldValueProp] = textToEnter;

    let inputEvent = new Event('input', { bubbles: true });
    inputField.dispatchEvent(inputEvent);
}

function checkElementValue(value, element) {
    if (!element) return;
    let elementValue = element.value !== undefined ? element.value : element.innerText;
    return sanitizeText(elementValue) === sanitizeText(value);
}

function tryStep(step, cb, errorActions, tryLimit = 20, intervalFrequency = 300) {
    let tryCount = 0;
    let doStepInterval = setInterval(() => {
        if (step()) {
            // previous step was successful; call the next one
            clearInterval(doStepInterval);
            if (cb) cb();
        } else if (tryCount === tryLimit) {
            clearInterval(doStepInterval);
            const errorAction = errorActions[getFunctionName(step)];
            if (errorAction) errorAction();
            console.log(`BYOP SMS - Step failed (${getFunctionName(step)}), retrying message.`);
        }
        tryCount++;
    }, intervalFrequency);
}

async function interactWithTab(
    message,
    tabOpenCallback = null,
    tabNotOpenCallback = null,
    loginTabOpenCallback = null,
    tryLimit = 3,
    intervalFrequency = 1000
) {
    return new Promise((resolve, reject) => {
        const errorMessage = `Please close any existing ${message.textPlatform} tabs and try again.`
        let retryCount = 0
        let shouldReturn = false

        let switchTab = async (arg = 'default') => {
            await browser.runtime
                .sendMessage(message)
                .then((response) => {
                    if (response?.type === 'TAB_NOT_OPEN') {
                        if (tabNotOpenCallback) {
                            tabNotOpenCallback();
                        }
                    } else if (response?.type === 'LOGIN_TAB_OPEN') {
                        if (loginTabOpenCallback) {
                            loginTabOpenCallback();
                        }
                        reject(false);
                        showFatalError(
                            `Please make sure you are logged in to ${message.textPlatform} and try again.`,
                            false
                        );
                    } else {
                        if (tabOpenCallback) {
                            tabOpenCallback();
                        }
                        resolve(true);
                        shouldReturn = true;
                    }
                })
                .catch((err) => {
                    console.error(err);
                    reject(false);
                    showFatalError(errorMessage, false);
                });

            if (shouldReturn) {
                return;
            } else {
                retryCount++;
                if (retryCount === tryLimit) {
                    reject(false);
                    showFatalError(errorMessage, false);
                } else {
                    setTimeout(() => switchTab('setTimeout'), intervalFrequency);
                }
            }
        }; // end switchTab

        switchTab('initial');
    });
}

function findContact(search, scrollHeight = 0) {
    const searchDigitsOnly = search.replace(/\D+/g, '');
    if (!searchDigitsOnly) {
        return;
    }

    let found = false;
    const contacts = document.querySelectorAll('.contact');
    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        const contactDigitsOnly = contact?.innerText.replace(/\D+/g, '');

        if (contactDigitsOnly && contactDigitsOnly === searchDigitsOnly) {
            found = true;
            contact.click();
            return;
        }
    }
    setTimeout(() => {
        const scrollContainer = document.querySelector('.message-unit-wrap');
        const currentScrollHeight = scrollContainer.scrollHeight;
        scrollContainer.scrollBy(0, currentScrollHeight);
        if (scrollHeight === currentScrollHeight) {
            alert('Contact Not Found');
            return;
        }
        // If the contact hasn't been found, keep scrolling until the end of the scrollContainer
        if (!found && currentScrollHeight > scrollHeight) {
            findContact(search, currentScrollHeight);
        }
    }, 1000);
}

function waitForElementToLoad(selector, tryLimit = 10) {
    return new Promise((resolve, reject) => {
        let elementLoaded;
        let tryCount = 0;
        let waitInterval = setInterval(() => {
            if (document.querySelector(selector)) elementLoaded = true;
            if (elementLoaded) {
                clearInterval(waitInterval);
                resolve(true);
            }
            if (tryCount === tryLimit) {
                clearInterval(waitInterval);
                reject(false);
            }
            tryCount++;
        }, 1000);
    });
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function chooseVariant(group){
    group = group.slice(1, -1);
    variants = group.split('|');
    return variants[getRandomInt(variants.length)];
}

function createVariantTemplate(textTemplate){
  const VARIANTS_REGEX = /\{[^{}]*\}/g;
  varGroups = textTemplate.match(VARIANTS_REGEX);
  if(varGroups){
    chosen = [];
    varGroups.forEach((group) => {
      chosen.push(chooseVariant(group));
    });
    const newMsg = textTemplate.replace(VARIANTS_REGEX, () => chosen.shift());
    return newMsg;
  }
  return textTemplate;
}
