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
    chrome.storage.sync.get(['sendCounts', 'dateLastSent', 'sendCountToday', 'sendHistory'], function (items) {
        console.log('items', items);
        const now = new Date();
        items.sendCounts = items.sendCounts || {};
        items.dateLastSent = items.dateLastSent || now.toISOString();
        items.sendCountToday = items.sendCountToday || 0;
        items.sendHistory = items.sendHistory || [];
        items.sendHistory.push(now.toISOString())


        for (var i = 0; i < items.sendHistory.length; i++) {
            const dateSent = new Date(items.sendHistory[i]);
            dateSent.setHours(dateSent.getHours() + 24);
            
            if (dateSent < now) {
                items.sendHistory.splice(i, 1);
            } else {
                // Items will always be added to the end of the array,so break 
                // out of the loop when we encounter the first element within 
                // the 24-hour window; everything else after that will be too
                break;
            }
        }

        const thisMonth = getYearAndMonth(now);
        const thisMonthCount = (items.sendCounts[thisMonth] || 0) + 1;


        chrome.storage.sync.set({
            sendCounts: {
                ...items.sendCounts,
                [thisMonth]: thisMonthCount
            },
            dateLastSent: now.toISOString(),
            sendCountToday: new Date(items.dateLastSent).toLocaleDateString() == now.toLocaleDateString() ? items.sendCountToday + 1 : 1,
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