const manifest = browser.runtime.getManifest();
const currentVersion = document.getElementById('current-version');
const appName = document.getElementById('app-name');


const availableTextPlatforms = {
    'messaging-app': "Messaging App",
    'google-messages': "Google Messages",
    'google-voice': "Google Voice",
    'text-free': "TextFree"
}

onOpen().catch(console.error);
currentVersion.innerText = 'v' + manifest.version;
appName.innerText = manifest.name;
document.getElementById('openOptions').addEventListener('click', async () => {
    await browser.runtime.openOptionsPage();
    window.close();
});

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

    // Set a default text platform is none is set
    if (!textPlatform) {
        textPlatform = 'messaging-app';
        browser.storage.local.set({ textPlatform: textPlatform });
    }

    if (textPlatform !== 'text-free' || !currentTab.url.startsWith('https://messages.textfree.us/conversation*')) {
        document.querySelector('.find-contact-row').style.display = 'none';
    }

    // Add functionality to find contact in contacts list on TextFree page
    document.getElementById('find-contact-button').addEventListener('click', async function () {
        browser.tabs.sendMessage(currentTab.id, {
            type: 'FIND_CONTACT',
            contactName: document.getElementById('contact-to-find').value
        });
    });

    // Populate Text Platform dropdown and display text platform value based on browser last storage data.
    for (var key in availableTextPlatforms) {
        var opt = document.createElement('option');
        opt.innerHTML = availableTextPlatforms[key];
        opt.value = key;
        textPlatformSelect.appendChild(opt);
    }
    textPlatformSelect.value = textPlatform;
    currentTextPlatform.innerText = availableTextPlatforms[textPlatform];

    // Display stats
    if (statsStartDate) {
        const date = new Date(statsStartDate).toLocaleDateString();
        document.getElementById('statsStartDate').innerText = date;
    }

    setTotalCallsToday();
    setTotalCallsAllTime();
}

async function setTotalCallsAllTime() {
    var items = await browser.storage.local.get(['sendCounts']);
    const totalCallsAllTime = items.sendCounts
        ? Object.values(items.sendCounts).reduce((total, val) => {
                return total + val;
            }, 0)
        : 0;

    document.getElementById('numCallsAllTime').innerText = `${totalCallsAllTime} text${
        totalCallsAllTime !== 1 ? 's' : ''
    }`;
}

async function setTotalCallsToday() {
    const sendHistory = await getSendHistory();
    const totalCallsToday = sendHistory.length;
    document.getElementById('numCallsToday').innerText = `${totalCallsToday} Text${totalCallsToday !== 1 ? 's' : ''}`;

    if (totalCallsToday === 0) {
        document.getElementById('encouragement').innerText = 'Log in to a phone bank to get started!';
    } else {
        document.getElementById('encouragement').innerText = 'Keep up the great work!';
    }
}
