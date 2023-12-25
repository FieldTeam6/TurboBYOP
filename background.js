const OPENVPB_REGEX = /https\:\/\/(www\.)?openvpb\.com/i
const OPENVPB_ORIGIN = 'https://www.openvpb.com/VirtualPhoneBank*'
const unregisterContentScripts = {}

// Run when installed or updated
browser.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
    const { statsStartDate } = await browser.storage.local.get(['statsStartDate'])
    if (!statsStartDate) {
        console.log('setting stats start date')
        await browser.storage.local.set({ statsStartDate: (new Date()).toISOString() })
    }
})

// Google Voice stuff

// For logging
chrome.runtime.onMessage.addListener(function (message, sender, response) {
    if (message.type === 'MESSAGE_SENT') {
        recordMessageSent();
    }
});

/**
 * Records the message count sent by month
 * @return {[type]} [description]
 */
recordMessageSent = () => {
    chrome.storage.sync.get(['sendCounts', 'sendHistory'], function (items) {
        console.log('items', items);
        const now = new Date();
        items.sendCounts = items.sendCounts || {};

        // We maintain a history of texts send over a rolling 24-hour
        // period so user's can more easily track how many messages they
        // are able to send before getting throttled by Google Voice
        items.sendHistory = updateSendHistory(items.sendHistory)
        items.sendHistory.push(now.toISOString())

        const thisMonth = getYearAndMonth(now);
        const thisMonthCount = (items.sendCounts[thisMonth] || 0) + 1;

        chrome.storage.sync.set({
            sendCounts: {
                ...items.sendCounts,
                [thisMonth]: thisMonthCount
            },
            sendHistory: items.sendHistory
        });
    });
}

/**
 * Takes a date and returns the Year and month, like 2019-03
 * @param  {Date} date
 * @return {string}      year and month
 */
function getYearAndMonth(date) {
    return date.getFullYear() + '-' + ("0" + (date.getMonth() + 1)).slice(-2)
}