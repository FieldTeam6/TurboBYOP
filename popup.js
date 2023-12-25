const OPENVPB_REGEX = /https\:\/\/(www\.)?openvpb\.com/i;
const OPENVPB_ORIGIN = 'https://www.openvpb.com/VirtualPhoneBank*';
const manifest = chrome.runtime.getManifest();
const currentVersion = document.getElementById('current-version');
const appName = document.getElementById('app-name');

let canEnable = false
let isEnabled = false
let siteName
let firstRender = true

onOpen().catch(console.error)
currentVersion.innerText = "v" + manifest.version;
appName.innerText = manifest.name;
document.getElementById('openOptions').addEventListener('click', async() => {
    await browser.runtime.openOptionsPage()
    window.close()
})
document.getElementById('toggleOnSite').addEventListener('mouseenter', hoverToggleSite)
document.getElementById('toggleOnSite').addEventListener('mouseleave', resetStatusLook)

let Switch = document.querySelector('input[type="checkbox"]');

Switch.addEventListener('change', async function () {
    if (Switch.checked) {
        // use Google Voice
        await browser.storage.local.set({ messageSwitch: true })
    } else {
        // use default messaging app
        await browser.storage.local.set({ messageSwitch: false })
    }
});

async function onOpen() {
    console.log('popup opened')
    const [{ statsStartDate, messageSwitch = false }, [currentTab], permissions] = await Promise.all([
        browser.storage.local.get([
            'statsStartDate',
            'messageSwitch'
        ]),
        browser.tabs.query({
            active: true,
            currentWindow: true
        }),
        browser.permissions.getAll()
    ])

    // Display switch value based on browser last storage data.
    if (messageSwitch) {
        document.querySelector('input[type="checkbox"]').checked = true;
    } else {
        document.querySelector('input[type="checkbox"]').checked = false;
    }

    // Display stats
    if (statsStartDate) {
        const date = new Date(statsStartDate).toLocaleDateString();
        document.getElementById('statsStartDate').innerText = date;
    }

    var {sendCountAllTime, sendCount24Hours} = await chrome.storage.sync.get(['sendCounts', 'sendHistory'])
        .then(function (items) {
        const sendCountAllTime = Object.values(items['sendCounts']).reduce((total, val) => {
            return total + val;
        }, 0);
        const sendHistory = updateSendHistory(items.sendHistory);
        const sendCount24Hours = sendHistory.length;
        chrome.storage.sync.set({ sendHistory: sendHistory });

        console.log('sendHistory', sendHistory);

        return { sendCountAllTime, sendCount24Hours };
    });

    setTotalCalls(sendCountAllTime, sendCount24Hours)

    if (currentTab && currentTab.url) {
        console.log('Current tab URL:', currentTab.url)

        if (OPENVPB_REGEX.test(currentTab.url)) {
            canEnable = true
            siteName = 'OpenVPB'
            origin = OPENVPB_ORIGIN
            isEnabled = permissions.origins.some((o) => OPENVPB_REGEX.test(o))
        }
    }

    if (isEnabled) {
        document.getElementById('toggleOnSite').setAttribute('href', '#')
        document.getElementById('toggleOnSite').classList.replace('text-muted', 'text-dark')
    } else if (canEnable) {
        document.getElementById('toggleOnSite').setAttribute('href', '#')
        document.getElementById('toggleOnSite').classList.replace('text-muted', 'text-dark')
    }
    resetStatusLook()
}

function setTotalCalls(totalCallsAllTime, totalCallsToday) {
    document.getElementById('numCallsToday').innerText = `${totalCallsToday} Text${totalCallsToday !== 1 ? 's' : ''}`
    document.getElementById('numCallsAllTime').innerText = `${totalCallsAllTime} text${totalCallsAllTime !== 1 ? 's' : ''}`

    if (totalCallsToday === 0) {
        document.getElementById('encouragement').innerText = 'Log in to a phone bank to get started!'
    } else {
        document.getElementById('encouragement').innerText = 'Keep up the great work!'
    }
}

function hoverToggleSite() {
    if (!canEnable) {
        return
    }

    if (!isEnabled) {
        document.getElementById('statusText').innerText = 'Click to Enable'
        document.getElementById('statusIcon').classList.remove('text-dark', 'text-danger')
        document.getElementById('statusIcon').classList.add('text-success')
        document.getElementById('toggleOnSite').title = `Click to Enable BYOP on ${siteName}`
    }
}

function resetStatusLook() {
    if (!canEnable) {
        document.getElementById('toggleOnSite').removeAttribute('href')
        return
    }
    document.getElementById('iconUnavailable').setAttribute('hidden', true)
    document.getElementById('iconPause').setAttribute('hidden', true)

    if (isEnabled) {
        document.getElementById('statusText').innerText = `Enabled on ${siteName}`
        document.getElementById('iconEnabled').removeAttribute('hidden')
        document.getElementById('iconDisabled').setAttribute('hidden', true)

    } else {
        document.getElementById('statusText').innerText = 'Click to Enable' // `Disabled on ${siteName}`
        document.getElementById('iconEnabled').setAttribute('hidden', true)
        document.getElementById('iconDisabled').removeAttribute('hidden')

        if (firstRender) {
            document.getElementById('iconDisabled').classList.add('glow')
            document.getElementById('statusText').classList.add('glow')
            setTimeout(() => {
                document.getElementById('iconDisabled').classList.remove('glow')
                document.getElementById('statusText').classList.remove('glow')
            }, 2500)
        }
    }

    document.getElementById('statusIcon').classList.remove('text-success', 'text-danger')
    document.getElementById('statusIcon').classList.add('text-dark')

    firstRender = false
}