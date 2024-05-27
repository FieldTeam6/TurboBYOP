const OPENVPB_REGEX = /https\:\/\/(www\.)?openvpb\.com/i;
const OPENVPB_ORIGIN = 'https://www.openvpb.com/VirtualPhoneBank*';
const manifest = browser.runtime.getManifest();
const currentVersion = document.getElementById('current-version');
const appName = document.getElementById('app-name');

const enabledSites = [
    {
        regex: /https\:\/\/(www\.)?openvpb\.com/i,
        origin: 'https://www.openvpb.com/VirtualPhoneBank*',
        name: 'OpenVPB'
    },
    {
        regex: /https\:\/\/(www\.)?voice\.google\.com/i,
        origin: 'https://voice.google.com',
        name: 'Google Voice'
    },
    {
        regex: /https\:\/\/(www\.)?messages\.textfree\.us\/web/i,
        origin: 'https://messages.textfree.us/web/*',
        name: 'TextFree'
    }
];

const availableTextPlatforms = {
    'messaging-app': "Messaging App",
    'google-voice': "Google Voice",
    'text-free': "TextFree"
}

let canEnable = false;
let isEnabled = false;
let siteName;
let firstRender = true;

onOpen().catch(console.error);
currentVersion.innerText = 'v' + manifest.version;
appName.innerText = manifest.name;
document.getElementById('openOptions').addEventListener('click', async () => {
    await browser.runtime.openOptionsPage();
    window.close();
});
document.getElementById('toggleOnSite').addEventListener('mouseenter', hoverToggleSite);
document.getElementById('toggleOnSite').addEventListener('mouseleave', resetStatusLook);

let textPlatformSelect = document.querySelector('#text-platform-select');
let currentTextPlatform = document.querySelector('#current-text-platform');

textPlatformSelect.addEventListener('change', async function () {
    const textPlatform = this.value;
    await browser.storage.local.set({ textPlatform });
    currentTextPlatform.innerText = availableTextPlatforms[textPlatform];
    setTotalCallsToday();
});

async function onOpen() {
    let [{ statsStartDate, textPlatform }, [currentTab], permissions] = await Promise.all([
        browser.storage.local.get(['statsStartDate', 'textPlatform']),
        browser.tabs.query({
            active: true,
            currentWindow: true
        }),
        browser.permissions.getAll()
    ]);

    if (!textPlatform) {
        textPlatform = 'messaging-app';
        browser.storage.local.set({ textPlatform: textPlatform });
    }

    if (
        (textPlatform === 'text-free' && !currentTab.url.startsWith('https://messages.textfree.us/web/')) ||
        textPlatform !== 'text-free'
    ) {
        document.querySelector('.find-contact-row').style.display = 'none';
    }

    // Add functionality to find contact in contacts list on TextFree page
    document.getElementById('find-contact-button').addEventListener('click', async function () {
        browser.tabs.sendMessage(currentTab.id, {
            type: 'FIND_CONTACT',
            contactName: document.getElementById('contact-to-find').value
        });
    });

    // Display text platform value based on browser last storage data.
    textPlatformSelect.value = textPlatform;
    currentTextPlatform.innerText = availableTextPlatforms[textPlatform];

    // Display stats
    if (statsStartDate) {
        const date = new Date(statsStartDate).toLocaleDateString();
        document.getElementById('statsStartDate').innerText = date;
    }

    setTotalCallsToday();
    setTotalCallsAllTime();

    if (currentTab && currentTab.url) {
        // Show "Enabled Site" if the site is one of the sites compatible with the BYOP extension
        enabledSites.forEach((site) => {
            if (site.regex.test(currentTab.url)) {
                canEnable = true;
                siteName = site.name;
                origin = site.origin;
                isEnabled = permissions.origins.some((o) => site.regex.test(o));
            }
        });
    }

    if (isEnabled) {
        document.getElementById('toggleOnSite').setAttribute('href', '#');
        document.getElementById('toggleOnSite').classList.replace('text-muted', 'text-dark');
    } else if (canEnable) {
        document.getElementById('toggleOnSite').setAttribute('href', '#');
        document.getElementById('toggleOnSite').classList.replace('text-muted', 'text-dark');
    }
    resetStatusLook();
}

async function setTotalCallsAllTime() {
    var items = await browser.storage.local.get(['sendCounts']);
    console.log('items', items);
    const totalCallsAllTime = items.sendCounts
        ? Object.values(items.sendCounts).reduce((total, val) => {
                return total + val;
            }, 0)
        : 0;

    console.log('totalCallsAllTime', totalCallsAllTime);

    document.getElementById('numCallsAllTime').innerText = `${totalCallsAllTime} text${
        totalCallsAllTime !== 1 ? 's' : ''
    }`;
}

async function setTotalCallsToday() {
    const sendHistory = await getSendHistory();
    const totalCallsToday = sendHistory.length;
    console.log('totalCallsToday', totalCallsToday);
    document.getElementById('numCallsToday').innerText = `${totalCallsToday} Text${totalCallsToday !== 1 ? 's' : ''}`;

    if (totalCallsToday === 0) {
        document.getElementById('encouragement').innerText = 'Log in to a phone bank to get started!';
    } else {
        document.getElementById('encouragement').innerText = 'Keep up the great work!';
    }
}

function hoverToggleSite() {
    if (!canEnable) {
        return;
    }

    if (!isEnabled) {
        document.getElementById('statusText').innerText = 'Click to Enable';
        document.getElementById('statusIcon').classList.remove('text-dark', 'text-danger');
        document.getElementById('statusIcon').classList.add('text-success');
        document.getElementById('toggleOnSite').title = `Click to Enable BYOP on ${siteName}`;
    }
}

function resetStatusLook() {
    if (!canEnable) {
        document.getElementById('toggleOnSite').removeAttribute('href');
        return;
    }
    document.getElementById('iconUnavailable').setAttribute('hidden', true);
    document.getElementById('iconPause').setAttribute('hidden', true);

    if (isEnabled) {
        document.getElementById('statusText').innerText = `Enabled on ${siteName}`;
        document.getElementById('iconEnabled').removeAttribute('hidden');
        document.getElementById('iconDisabled').setAttribute('hidden', true);
    } else {
        document.getElementById('statusText').innerText = 'Click to Enable'; // `Disabled on ${siteName}`
        document.getElementById('iconEnabled').setAttribute('hidden', true);
        document.getElementById('iconDisabled').removeAttribute('hidden');

        if (firstRender) {
            document.getElementById('iconDisabled').classList.add('glow');
            document.getElementById('statusText').classList.add('glow');
            setTimeout(() => {
                document.getElementById('iconDisabled').classList.remove('glow');
                document.getElementById('statusText').classList.remove('glow');
            }, 2500);
        }
    }

    document.getElementById('statusIcon').classList.remove('text-success', 'text-danger');
    document.getElementById('statusIcon').classList.add('text-dark');

    firstRender = false;
}
