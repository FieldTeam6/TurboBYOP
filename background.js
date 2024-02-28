const OPENVPB_REGEX = /https\:\/\/(www\.)?openvpb\.com/i
const OPENVPB_ORIGIN = 'https://www.openvpb.com/VirtualPhoneBank*'
const unregisterContentScripts = {}

// Run when installed or updated
chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
    const { statsStartDate } = await chrome.storage.local.get(['statsStartDate'])
    if (!statsStartDate) {
        console.log('setting stats start date')
        await chrome.storage.local.set({ statsStartDate: new Date().toISOString() })
    }
})

// Google Voice stuff

// For logging
chrome.runtime.onMessage.addListener(function (message, sender, response) {
    if (message.type === 'MESSAGE_SENT') {
        recordMessageSent()
    }
    if (message.type === 'OPEN_OPTIONS_PAGE') {
        chrome.runtime.openOptionsPage()
    }
    if (message.type === 'SWITCH_TAB') {
        // Find Text Free tab
        findTabId(message.url)
            .then((id) => {
                chrome.tabs.update(id, { selected: true })
                response({ type: 'TAB_OPEN' })
            })
            .catch((err) => {
                console.error(err)
                if (message.loginUrl) {
                    // Check if Login page is open
                    findTabId(message.loginUrl)
                        .then(() => {
                            response({ type: 'LOGIN_TAB_OPEN' })
                        })
                        .catch((err) => {
                            console.error(err)
                            response({ type: 'TAB_NOT_OPEN' })
                        })
                }
            })
        return true
    }

    if (message.type === 'TALK_TO_TAB') {
        findTabId(message.url)
            .then((id) => {
                chrome.tabs
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
                }
            })
        return true
    }
})

/**
 * Records the message count sent by month
 * @return {[type]} [description]
 */
recordMessageSent = () => {
    chrome.storage.sync.get(['sendCounts', 'sendHistory'], function (items) {
        const now = new Date()
        items.sendCounts = items.sendCounts || {}

        // We maintain a history of texts send over a rolling 24-hour
        // period so users can more easily track how many messages they
        // are able to send before getting throttled by Google Voice
        items.sendHistory.push(now.toISOString())

        const thisMonth = getYearAndMonth(now)
        const thisMonthCount = (items.sendCounts[thisMonth] || 0) + 1

        chrome.storage.sync.set({
            sendCounts: {
                ...items.sendCounts,
                [thisMonth]: thisMonthCount
            },
            sendHistory: items.sendHistory
        })
    })
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
        chrome.tabs
            .query({
                url,
                currentWindow: true
            })
            .then((tabs) => {
                const tabId = tabs[0]?.id
                if (tabId) resolve(tabId)
                else reject(false)
            })
            .catch((err) => reject(false))
    })
}
