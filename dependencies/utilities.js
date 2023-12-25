function updateSendHistory(sendHistory) {

    if (!sendHistory) {
        return [];
    }

    const now = new Date();

    for (var i = 0; i < sendHistory.length; i++) {
        const dateSent = new Date(sendHistory[i]);
        dateSent.setHours(dateSent.getHours() + 24);
        
        if (dateSent < now) {
            sendHistory.splice(i, 1);
        } else {
            // Items will always be added to the end of the array,so break 
            // out of the loop when we encounter the first element within 
            // the 24-hour window; everything else after that will be too
            break;
        }
    }

    return sendHistory
}