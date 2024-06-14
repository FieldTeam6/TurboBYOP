async function getSendHistory(increment = false) {
    const now = new Date();
    let { sendHistory = {}, textPlatform } = await browser.storage.local.get(['sendHistory', 'textPlatform']);
    //console.log('sendHistory', sendHistory);
    //console.log('textPlatform', textPlatform);
    let platformSendHistory = sendHistory[textPlatform] || [];
    //console.log('platformSendHistory', platformSendHistory);

    if (platformSendHistory.length > 0) {
        for (var i = 0; i < platformSendHistory.length; i++) {
            const dateSent = new Date(platformSendHistory[i]);
            dateSent.setHours(dateSent.getHours() + 24);

            if (!(dateSent < now)) {
                // Items will always be added to the end of the array,so break 
                // out of the loop when we encounter the first element within 
                // the 24-hour window; everything else after that will be too
                break;
            }
        }

        // discard everything prior to element i as it is more than 24 hours old
        platformSendHistory = platformSendHistory.slice(i);
    }

    if (increment) {
        platformSendHistory.push(now.toISOString())
    }
    //console.log('platformSendHistory', platformSendHistory);

    browser.storage.local.set({
        sendHistory: {
            ...sendHistory,
            [textPlatform]: platformSendHistory
        }
    });

    return platformSendHistory;
}