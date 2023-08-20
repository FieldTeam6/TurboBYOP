const OPENVPB_REGEX = /https\:\/\/(www\.)?openvpb\.com/i;
const OPENVPB_ORIGIN = 'https://www.openvpb.com/VirtualPhoneBank*';

let canEnable = false
let isEnabled = false
let siteName
let activeTabId
let firstRender = true

onOpen().catch(console.error)
document.getElementById('openOptions').addEventListener('click', async() => {
    await browser.runtime.openOptionsPage()
    window.close()
})
document.getElementById('toggleOnSite').addEventListener('mouseenter', hoverToggleSite)
document.getElementById('toggleOnSite').addEventListener('mouseleave', resetStatusLook)

let Switch = document.querySelector('input[type="checkbox"]');

Switch.addEventListener('change', async function () {
    if (Switch.checked) {
        // do this
        console.log('Checked');
        await browser.storage.local.set({ messageSwitch: true })
    } else {
        // do that
        console.log('Not checked');
        await browser.storage.local.set({ messageSwitch: false })
    }
});

async function onOpen() {
    console.log('popup opened')
    const [{ statsStartDate, messageSwitch = false }, [activeTab], permissions] = await Promise.all([
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
        const date = new Date(statsStartDate)
        document.getElementById('statsStartDate').innerText = `${date.getMonth() + 1}/${date.getDate()}`
    }

    var sendCounts = await chrome.storage.sync.get('sendCounts').then(function (value) {
        if (!value['sendCounts']) {
            return 0;
        }

        return Object.values(value['sendCounts']).reduce((total, val) => {
            return total + val;
        }, 0);
    });
    showTotalCalls(sendCounts)

    if (activeTab) {
        activeTabId = activeTab.id

        if (activeTab.url) {
            console.log('Current tab URL:', activeTab.url)

            if (OPENVPB_REGEX.test(activeTab.url)) {
                canEnable = true
                siteName = 'OpenVPB'
                origin = OPENVPB_ORIGIN
                isEnabled = permissions.origins.some((o) => OPENVPB_REGEX.test(o))
            }
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

function showTotalCalls(totalCalls) {
    document.getElementById('numCalls').innerText = `${totalCalls} Text${totalCalls !== 1 ? 's' : ''}`
    if (totalCalls === 0) {
        document.getElementById('encouragement').innerText = 'Login to a phone bank to get started!'
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