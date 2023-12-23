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
    console.log('message', message);

	if (message.type === 'MESSAGE_SENT') {
		recordMessageSent();
	}
});

/**
 * Records the message count sent by month
 * @return {[type]} [description]
 */
recordMessageSent = () => {
	chrome.storage.sync.get(['sendCounts', 'dateLastSent', 'sendCountToday'], function(items) {
		const todaysDate = getYearMonthAndDay(new Date());
		console.log('items', items);
		items.sendCounts = items.sendCounts || {};
		items.dateLastSent = items.dateLastSent || todaysDate;
		items.sendCountToday = items.sendCountToday || 0;

		const thisMonth = getYearAndMonth(new Date());
		const thisMonthCount = (items.sendCounts[thisMonth] || 0) + 1;

		chrome.storage.sync.set({
			sendCounts: {
				...items.sendCounts,
				[thisMonth]: thisMonthCount
			},
			dateLastSent: todaysDate,
			sendCountToday: items.dateLastSent == todaysDate ? items.sendCountToday + 1 : 1
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


/**
 * Takes a date and returns the Year and month, like 2019-03
 * @param  {Date} date
 * @return {string}      year and month
 */
 function getYearMonthAndDay(date) {
	var fullDate = date.getFullYear() + '-' + ("0" + (date.getMonth() + 1)).slice(-2) + '-' + date.getDate();
	console.log('fullDate', fullDate);
	return fullDate;
}