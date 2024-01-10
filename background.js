const OPENVPB_REGEX = /https\:\/\/(www\.)?openvpb\.com/i
const OPENVPB_ORIGIN = 'https://www.openvpb.com/VirtualPhoneBank*'
const unregisterContentScripts = {}

// Run when installed or updated
browser.runtime.onInstalled.addListener(async () => {
    const { statsStartDate } = await browser.storage.local.get(['statsStartDate'])
    if (!statsStartDate) {
        console.log('setting stats start date')
        await browser.storage.local.set({ statsStartDate: (new Date()).toISOString() })
    }
})

// Google Voice stuff

// For logging
browser.runtime.onMessage.addListener(async (message, sender, response) => {
    if (message.type === 'MESSAGE_SENT') {
        recordMessageSent();
    } else if (message.type === 'USER_THROTTLED') {
        recordUserThrottled();
    }
});

/**
 * Records the message count sent by month
 * @return {[type]} [description]
 */
async function recordMessageSent() {
    var items = await chrome.storage.sync.get(['sendCounts', 'sendHistory']);
    const now = new Date();
    items.sendCounts = items.sendCounts || {};
    console.log('sendHistory', items.sendHistory);
    items.sendHistory = cullSendHistory(items.sendHistory);

    // We maintain a history of texts send over a rolling 24-hour
    // period so users can more easily track how many messages they
    // are able to send before getting throttled by Google Voice
    items.sendHistory.push(now.toISOString())
    console.log('sendHistory', items.sendHistory);

    const thisMonth = getYearAndMonth(now);
    const thisMonthCount = (items.sendCounts[thisMonth] || 0) + 1;

    chrome.storage.sync.set({
        sendCounts: {
            ...items.sendCounts,
            [thisMonth]: thisMonthCount
        },
        sendHistory: items.sendHistory
    });

    browser.storage.local.set({
        sendCounts: {
            ...items.sendCounts,
            [thisMonth]: thisMonthCount
        },
        sendHistory: items.sendHistory
    });
}

async function recordUserThrottled() {
    console.log('recordUserThrottled');
    //const { sendHistory = [] } = await browser.storage.local.get(['sendHistory'])
    let sendHistory = await getSendHistory();
    console.log('sendHistory', sendHistory);
    await browser.storage.local.set({ throttledSendCount: sendHistory.length });
}

/**
 * Takes a date and returns the Year and month, like 2019-03
 * @param  {Date} date
 * @return {string}      year and month
 */
function getYearAndMonth(date) {
    return date.getFullYear() + '-' + ("0" + (date.getMonth() + 1)).slice(-2)
}