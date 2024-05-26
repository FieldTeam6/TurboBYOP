async function getSendHistory(increment = false) {
    const now = new Date();

    const sendHistoryStorageVar = await getSendHistoryStorageVar();
    console.log('sendHistoryStorageVar', sendHistoryStorageVar);
    let { sendHistory = [] } = await browser.storage.local.get([sendHistoryStorageVar]);
    console.log('sendHistory from storage', sendHistory);

    if (sendHistory && sendHistory.length > 0) {
        for (var i = 0; i < sendHistory.length; i++) {
            const dateSent = new Date(sendHistory[i]);
            dateSent.setHours(dateSent.getHours() + 24);

            if (!(dateSent < now)) {
                // Items will always be added to the end of the array,so break 
                // out of the loop when we encounter the first element within 
                // the 24-hour window; everything else after that will be too
                break;
            }
        }

        // discard everything prior to element i as it is more than 24 hours old
        sendHistory = sendHistory.slice(i);
    }

    if (increment) {
        sendHistory.push(now.toISOString())
    }

    console.log('sendHistory', sendHistory)

    browser.storage.local.set({ sendHistoryStorageVar: sendHistory });

    return sendHistory;
}

async function getSendHistoryStorageVar() {
    let { textPlatform } = await browser.storage.local.get(['textPlatform']);
    return 'sendHistory-' + textPlatform;
}