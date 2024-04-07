/**
 * removes all non-numeric characters from the number string
 * @param  {string}   number i.e. +1 (223) 456-7890
 * @return {string}         i.e. 2234567890
 */
function formatNumber(number) {
    var simplifiedNumber = number.trim().replace(/\D/g, '')
    // remove international code for US numbers
    if (simplifiedNumber.length === 11 && simplifiedNumber.charAt(0) === '1') {
        simplifiedNumber = simplifiedNumber.substr(1)
    }
    return simplifiedNumber
}

function getFunctionName(func) {
    return func.name.replace(/bound /g, '')
}

/**
 * continually calls the given method until successful
 * @param {Function}   method         should return true when successful, or false when we should give up early
 * @param {bool}       silenceErrors  true if we should not alert on errors
 * @param {Function}   cb             to be called with the results from method when we're done trying
 */
function keepTrying(method, silenceErrors, cb) {
    const frequency = 100; // try every 100ms
    let tryCount = 4 * 1000 / frequency; // keep trying for 4 seconds
    var keepTryingInterval = setInterval(function () {
        var successful = method();
        var giveUp = successful === false || tryCount-- < 0;
        let functionName = getFunctionName(method);

        if (successful === true || giveUp) {
            if (functionName === 'confirmSent') {
                // If error occurs on confirmSent, it is almost always 
                // indicative to throttling and we want to abort
                silenceErrors = false;
            }
            //console.log('silenceErrors', silenceErrors);
            clearInterval(keepTryingInterval);
            // the app failed
            if (!silenceErrors && giveUp) {
                if (siteIsGoogleVoice) {
                    if (functionName === 'confirmSent') {
                        showFatalError(`You've been throttled by Google Voice.  Please try a different campaign, or wait 24 hours and try again.\n\nError: "${functionName}" failed.`, true)
                    } else {
                        showFatalError(`If the problem persists, please report the error in the BYOP Slack channel or via the help link in the extension popup.\n\nError: "${functionName}" failed.`, true);
                    }
                } else {
                    showFatalError(
                        "Are you sure Google Voice texting via Hangouts is enabled?\nAlso, be aware that this extension is not compatible with the Google Hangouts Chrome extension. If you have the Hangouts extension installed you'll need to temporarily disable it.",
                        false
                    )
                }
            }
            if (cb) {
                cb(successful)
            }
        }
    }, frequency)
}

/**
 * continually calls the given method until successful
 * Promisified for use with async/await
 * @param {Function}   method         should return true when successful, or false when we should give up early
 * @param {bool}       silenceErrors  true if we should not alert on errors
 * @param {Function}   cb             to be called with the results from method when we're done trying
 */
function keepTryingAsPromised(method, silenceErrors) {
    console.log('BYOP SMS - Running: ', getFunctionName(method))
    const waitTime = 400 // 400ms
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            keepTrying(method, silenceErrors, (successful) => {
                resolve(successful)
            })
        }, waitTime)
    })
}

/**
 * shows the message as an alert, reloads the page if instructed to
 * @param {*} message
 * @param {*} reload
 */
function showFatalError(message, reload) {
    if (typeof siteManager !== 'undefined' && siteManager) {
        siteManager.messagesToSend.length = 0
    }
    // Re-enable Set Up Text Message button
    browser.runtime.sendMessage({
        type: 'TALK_TO_TAB',
        url: 'https://www.openvpb.com/VirtualPhoneBank*',
        tabType: 'SENDING_ERROR'
    })
    const manifest = browser.runtime.getManifest()
    const reloadMessage = '\n\nWhen you click "OK" the page will refresh.'
    const fullMessage = `BYOP v${manifest.version}: Text failed.\n\n${message} ${reload ? reloadMessage : ''}`
    console.error('BYOP SMS - ' + fullMessage)
    alert(fullMessage)
    if (reload) {
        console.log('reloading page')
        window.location.reload()
    }
}

/**
 * Removes unicode characters from the text
 */
function removeUnicode(text) {
    return text.replace(
        /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
        ''
    )
}

/**
 * Removes whitespace from the text
 */
function removeWhitespace(text) {
    return text.replace(/\s/g, '')
}

function sanitizeText(text) {
    return removeWhitespace(removeUnicode(text))
}

const simulateKeyPress = (element) => {
    element.dispatchEvent(
        new Event('change', {
            bubbles: true,
            cancelable: true
        })
    )
}

function simulateTextEntry(inputField, textToEnter) {
    inputField.focus()
    let inputFieldValueProp = inputField.value !== undefined ? 'value' : 'innerText'
    inputField[inputFieldValueProp] = textToEnter

    var charCode = ' '.charCodeAt();
    let keydownEvent = new Event('keydown', { keyCode: charCode });
    inputField.dispatchEvent(keydownEvent);

    let keypressEvent = new Event('keypress', { keyCode: charCode });
    inputField.dispatchEvent(keypressEvent);

    let inputEvent = new Event('input', { bubbles: true });
    inputField.dispatchEvent(inputEvent);

    let keyupEvent = new Event('keyup', { keyCode: charCode });
    inputField.dispatchEvent(keyupEvent);
}

function enterText(inputField, textToEnter) {
    inputField.focus()
    let inputFieldValueProp = inputField.value !== undefined ? 'value' : 'innerText'

    inputField[inputFieldValueProp] = textToEnter
    simulateKeyPress(inputField)
    inputField.blur()
}

function checkElementValue(value, element) {
    if (!element) return
    let elementValue = element.value !== undefined ? element.value : element.innerText
    return sanitizeText(elementValue) === sanitizeText(value)
}

function fillElementAndCheckValue(value, inputElement, elementWithValue = inputElement) {
    if (inputElement) {
        enterText(inputElement, value)
        return checkElementValue(value, elementWithValue)
    }
    return false
}

function tryStep(step, cb, errorActions, tryLimit = 30, intervalFrequency = 100) {
    let tryCount = 0
    let doStepInterval = setInterval(() => {
        if (step()) {
            clearInterval(doStepInterval)
            if (cb) cb()
        } else if (tryCount === tryLimit) {
            clearInterval(doStepInterval)
            const errorAction = errorActions[getFunctionName(step)]
            if (errorAction) errorAction()
            console.log(`BYOP SMS - Step failed (${getFunctionName(step)}), retrying message.`)
        }
        tryCount++
    }, intervalFrequency)
}

async function interactWithTab(
    message,
    tabOpenCB = null,
    tabNotOpenCB = null,
    loginTabOpenCB = null,
    tryLimit = 30,
    intervalFrequency = 100
) {
    return new Promise((resolve, reject) => {
        console.log('message', message)
        const errorMessage = `Please close any existing ${message.textPlatform} tabs and try again.`
        let retryCount = 0
        let switchTabInterval = setInterval(() => {
            browser.runtime
                .sendMessage(message)
                .then((response) => {
                    console.log('response', response);
                    if (response?.type === 'TAB_NOT_OPEN') {
                        if (tabNotOpenCB) {
                            tabNotOpenCB()
                        }
                    } else if (response?.type === 'LOGIN_TAB_OPEN') {
                        clearInterval(switchTabInterval)
                        if (loginTabOpenCB) loginTabOpenCB()
                        reject(false)
                        showFatalError(
                            `Please make sure you are logged in to ${message.textPlatform} and try again.`,
                            false
                        )
                    } else {
                        clearInterval(switchTabInterval)
                        if (tabOpenCB) {
                            tabOpenCB()
                        }
                        resolve(true)
                    }
                })
                .catch((err) => {
                    console.error(err)
                    clearInterval(switchTabInterval)
                    reject(false)
                    showFatalError(errorMessage, false)
                })
            retryCount++
            if (retryCount === tryLimit) {
                clearInterval(switchTabInterval)
                reject(false)
                showFatalError(errorMessage, false)
            }
        }, intervalFrequency)
    })
}

function findContact(search, scrollHeight = 0) {
    const searchDigitsOnly = search.replace(/\D+/g, '')
    if (!searchDigitsOnly) {
        return
    }

    let found = false
    const contacts = document.querySelectorAll('.contact')
    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i]
        const contactDigitsOnly = contact.querySelector('.name')?.innerText.replace(/\D+/g, '')

        if (contactDigitsOnly && contactDigitsOnly === searchDigitsOnly) {
            found = true
            contact.click()
            return
        }
    }
    setTimeout(() => {
        const scrollContainer = document.querySelector('.message-unit-wrap')
        const currentScrollHeight = scrollContainer.scrollHeight
        scrollContainer.scrollBy(0, currentScrollHeight)
        if (scrollHeight === currentScrollHeight) {
            alert('Contact Not Found')
            return
        }
        // If the contact hasn't been found, keep scrolling until the end of the scrollContainer
        if (!found && currentScrollHeight > scrollHeight) {
            findContact(search, currentScrollHeight)
        }
    }, 1000)
}

function waitForElementToLoad(selector, tryLimit = 5) {
    return new Promise((resolve, reject) => {
        let elementLoaded
        let tryCount = 0
        let waitInterval = setInterval(() => {
            if (document.querySelector(selector)) elementLoaded = true
            if (elementLoaded) {
                clearInterval(waitInterval)
                resolve(true)
            }
            if (tryCount === tryLimit) {
                clearInterval(waitInterval)
                reject(false)
            }
            tryCount++
        }, 1000)
    })
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
