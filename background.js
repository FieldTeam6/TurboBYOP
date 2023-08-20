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

function getContentScripts(origin) {
    console.log('getContactScripts');
    let originSpecificJs
    if (OPENVPB_REGEX.test(origin)) {
        originSpecificJs = { file: 'openvpb.js' }
    }
    return [
        { file: 'dependencies/browser-polyfill.js' },
        { file: 'dependencies/tingle.js' },
        { file: 'vpb-common.js' },
        originSpecificJs
    ]
}

async function enableOrigin(origin) {
    console.log(`registering content scripts for ${origin}`)
    try {
        const { unregister } = await browser.contentScripts.register({
            matches: [origin],
            js: getContentScripts(origin),
            css: [{ file: 'dependencies/tingle.css' }]
        })
        unregisterContentScripts[origin] = unregister
    } catch (err) {
        console.error(`error registering content script for ${origin}`, err)
    }
}

async function disableOrigin(origin) {
    if (typeof unregisterContentScripts[origin] === 'function') {
        (unregisterContentScripts[origin])()
        delete unregisterContentScripts[origin]
        console.log(`disabled content scripts for ${origin}`)
        return true
    } else {
        return false
    }
}
// Google Voice stuff

// For logging
chrome.runtime.onMessage.addListener(function (message, sender, response) {
    console.log('message', message);

	if (message.type === 'MESSAGE_SENT') {
		recordMessageSent();
	}

    if (message.type === "ENABLE_ORIGIN") {
        return enableOrigin(message.origin);
    }

    if (message.type === "DISABLE_ORIGIN") {
        return disableOrigin(message.origin);
    }

    if (message.type === "GET_CONTENT_SCRIPTS") {
        return getContentScripts(origin);
    }
});

/**
 * Records the message count sent by month
 * @return {[type]} [description]
 */
recordMessageSent = () => {
	chrome.storage.sync.get('sendCounts', function(items) {
		items.sendCounts = items.sendCounts || {};
		const thisMonth = getYearAndMonth(new Date());
		const thisMonthCount = (items.sendCounts[thisMonth] || 0) + 1;

		chrome.storage.sync.set({
			sendCounts: {
				...items.sendCounts,
				[thisMonth]: thisMonthCount
			}
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
