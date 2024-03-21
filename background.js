const OPENVPB_REGEX = /https\:\/\/(www\.)?openvpb\.com/i
const OPENVPB_ORIGIN = 'https://www.openvpb.com/VirtualPhoneBank*'
const unregisterContentScripts = {}

// Run when installed or updated
browser.runtime.onInstalled.addListener(() => {
    const { statsStartDate } = browser.storage.local.get(['statsStartDate'])
    if (!statsStartDate) {
        console.log('setting stats start date')
        browser.storage.local.set({ statsStartDate: (new Date()).toISOString() })
    }
})

// Google Voice stuff

// For logging
browser.runtime.onMessage.addListener((message, sender, response) => {
    console.log('called listener', message)
    if (message.type === 'MESSAGE_SENT') {
        recordMessageSent()
    }

    if (message.type === 'OPEN_OPTIONS_PAGE') {
        browser.runtime.openOptionsPage()
    }

    if (message.type === 'SWITCH_TAB') {
        // Find TextFree tab
        findTabId(message.url)
            .then((id) => {
                browser.tabs.update(id, { selected: true })
                response({ type: 'TAB_OPEN' })
            })
            .catch((err) => {
                console.error(err)
                if (message.loginUrl) {
                    // Check if Login page is open
                    findTabId(message.loginUrl)
                        .then(() => {
                            console.log('LOGIN TAB OPEN')
                            response({ type: 'LOGIN_TAB_OPEN' })
                        })
                        .catch((err) => {
                            console.log('TAB NOT OPEN')
                            console.error(err)
                            response({ type: 'TAB_NOT_OPEN' })
                        })
                } else {
                    response({ type: 'TAB_NOT_OPEN' })
                }
            })
        return true
    }

    if (message.type === 'TALK_TO_TAB') {
        console.log('TALK TO TAB')
        findTabId(message.url)
            .then((id) => {
                console.log('id', id)
                browser.tabs
                    .sendMessage(id, {
                        ...message,
                        type: message.tabType
                    })
                    .then(() => {
                        response({ type: 'TAB_OPEN' })
                    })
                    .catch((err) => {
                        console.error(err)
                        response({ type: 'TAB_NOT_OPEN' })
                    })
            })
            .catch((err) => {
                console.error(err)
                if (message.loginUrl) {
                    // Check if Login page is open
                    findTabId(message.loginUrl, response)
                        .then(() => {
                            response({ type: 'LOGIN_TAB_OPEN' })
                        })
                        .catch((err) => {
                            console.error(err)
                            response({ type: 'TAB_NOT_OPEN' })
                        })
                } else {
                    response({ type: 'TAB_NOT_OPEN' })
                }
            })
        return true
    }
})

/**
 * Records the message count sent by month
 * @return {[type]} [description]
 */
async function recordMessageSent() {
    var items = await browser.storage.local.get(['sendCounts']);
    items.sendCounts = items.sendCounts || {};
    items.sendHistory = await getSendHistory(true);
    
    // We maintain a history of texts send over a rolling 24-hour
    // period so users can more easily track how many messages they
    // are able to send before getting throttled by Google Voice
    const now = new Date();
    const thisMonth = getYearAndMonth(now);
    const thisMonthCount = (items.sendCounts[thisMonth] || 0) + 1;

    browser.storage.local.set({
        sendCounts: {
            ...items.sendCounts,
            [thisMonth]: thisMonthCount
        }
    });
}

/**
 * Takes a date and returns the Year and month, like 2019-03
 * @param  {Date} date
 * @return {string}      year and month
 */
function getYearAndMonth(date) {
    return date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2)
}

/**
 * Finds a tab in the current window
 * @param {string} url
 * @returns {Promise<number>} A promise that contains the id of the tab when fulfilled
 */
async function findTabId(url) {
    return new Promise((resolve, reject) => {
        browser.tabs
            .query({
                url,
                currentWindow: true
            })
            .then((tabs) => {
                console.log('tabs', tabs);
                const tabId = tabs[0]?.id

                if (tabId) {
                    resolve(tabId)
                } else {
                    reject(false)
                }
            })
            .catch((err) => {
                console.error(err)
                reject(false)
            })
    })
}
