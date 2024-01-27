async function getSendHistory(increment = false) {

    let { sendHistory } = await browser.storage.local.get(['sendHistory']);
    console.log('sendHistory', sendHistory);

    if (!sendHistory) {
        return [];
    }

    const now = new Date();

    for (var i = 0; i < sendHistory.length; i++) {
        const dateSent = new Date(sendHistory[i]);
        console.log('dateSent', dateSent.toISOString());
        dateSent.setHours(dateSent.getHours() + 24);

        console.log(`${dateSent.toISOString()} < ${now.toISOString()}`, dateSent < now);
        if (dateSent < now) {
            sendHistory.splice(i, 1);
        } else {
            // Items will always be added to the end of the array,so break 
            // out of the loop when we encounter the first element within 
            // the 24-hour window; everything else after that will be too
            break;
        }
    }

    if (increment) {
        sendHistory.push(now.toISOString())
    }

    browser.storage.local.set({ sendHistory: sendHistory });

    return sendHistory
}