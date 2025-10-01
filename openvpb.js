const DESIGNATED_CONTACT_REGEX = /designated[ _-]?contact/i

// OpenVPB displays a pop-up after you make your first call
// This is annoying for the BYOP experience because it looks like
// it's not loading the next contact right away. So, we just click through
// that popup
let firstCall = true;

const THEIR_NAME_REGEX = /[\[\(\{<]+\s*(?:their|thier|there)\s*name\s*[\]\)\}>]+/gi;
const YOUR_NAME_REGEX = /[\[\(\{<]+\s*(?:your|y[ou]r|you'?re|my)\s*name\s*[\]\)\}>]+/gi;

const configuration = {
    testmode: false,
    defaultNumber: '1234567890'
};

browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'RECORD_TEXT_IN_DB') {
        recordTextInDB();
    }
    // If there is an error when trying to send the text message,
    // re-enable the Set Up Text Message button so users can try again
    if (message.type === 'SENDING_ERROR') {
        const setUpTextMessageButton = document.querySelector('#turbovpbcontainer button');
        setUpTextMessageButton.disabled = false;
        setUpTextMessageButton.style.opacity = 1;
        setUpTextMessageButton.style.cursor = 'pointer';
    }
});

setInterval(getContactDetails, 50);

function saveNextButton() {
    return (
        document.getElementById('openvpbsavenextbutton') ||
        document.getElementById('openVpbSaveNextButton') ||
        document.getElementById('contactresultssavenextbutton') ||
        document.getElementById('contactResultsSaveNextButton')
    );
}

async function launchMessagingApp(currentPhoneNumber, contactName) {
    let { textPlatform, yourName, messageTemplates } = await browser.storage.local.get([
        'textPlatform',
        'yourName',
        'messageTemplates'
    ]);

    let message;
    if (messageTemplates) {
        message = messageTemplates[0]?.message;
    }
    const scriptText = document.querySelector('[id*=scripttext]').innerText;
    let messageBody = scriptText.match(THEIR_NAME_REGEX) ? scriptText : message;

    if (!messageBody || !messageBody.match(THEIR_NAME_REGEX)) {
        showFatalError('Please add the script message to the BYOP extension message template', false);
        browser.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
        return false;
    }

    messageBody = messageBody.replace(THEIR_NAME_REGEX, contactName).replace(YOUR_NAME_REGEX, yourName);
    console.log('currentPhoneNumber', currentPhoneNumber);
    console.log('messageBody', messageBody);

    if (configuration['testmode'] == true) {
        currentPhoneNumber = configuration['defaultNumber'];
    }

    switch (textPlatform) {
        case 'google-voice':
            let digitsOnlyPhoneNumber = currentPhoneNumber.replace(/\D+/g, '');

            try {
                const switchedTab = await interactWithTab({
                        textPlatform: 'Google Voice',
                        url: `${gvUrl}*`,
                        loginUrl: 'https://voice.google.com/about',
                        type: 'SWITCH_TAB',
                        openVpbUrl: window.location.href
                    },
                    null,
                    () => {
                        window.open(gvUrl, '_blank');
                    }
                );

                if (switchedTab) {
                    // Send contact details to TextFree tab to send text
                    await interactWithTab({
                        textPlatform: 'Google Voice',
                        type: 'TALK_TO_TAB',
                        tabType: 'SEND_MESSAGE',
                        url: `${gvUrl}*`,
                        loginUrl: 'https://voice.google.com/about',
                        message: messageBody,
                        phoneNumber: digitsOnlyPhoneNumber,
                        contactName,
                        openVpbUrl: window.location.href
                    });
                }
            } catch (err) {
                console.error(err);
            }

            break;
        case 'messaging-app':
            console.log(`sms://${currentPhoneNumber};?&body=${encodeURIComponent(messageBody)}`);
            window.open(`sms://${currentPhoneNumber};?&body=${encodeURIComponent(messageBody)}`, '_blank');
            recordTextInDB();
            browser.runtime.sendMessage({ type: 'MESSAGE_SENT' });
            break;
        case 'text-free':
            try {
                // Switch to TextFree Tab or open it
                const switchedTab = await interactWithTab(
                    {
                        textPlatform: 'TextFree',
                        url: `${tfUrl}*`,
                        loginUrl: 'https://messages.textfree.us/login',
                        type: 'SWITCH_TAB',
                        openVpbUrl: window.location.href
                    },
                    null,
                    () => {
                        window.open(tfUrl, '_blank');
                    }
                );

                if (switchedTab) {
                    // Send contact details to TextFree tab to send text
                    await interactWithTab({
                        textPlatform: 'TextFree',
                        type: 'TALK_TO_TAB',
                        tabType: 'SEND_MESSAGE',
                        url: `${tfUrl}*`,
                        loginUrl: 'https://messages.textfree.us/login',
                        message: messageBody,
                        phoneNumber: currentPhoneNumber,
                        contactName,
                        openVpbUrl: window.location.href
                    });
                }
            } catch (err) {
                console.error(err);
            }

            break;
    }

    return true;
}

function recordTextInDB() {
    const surveySelect = document.getElementsByClassName('surveyquestion-element-select')[0];

    function simulateClick(item) {
        item.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        item.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        item.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        item.dispatchEvent(new Event('change', { bubbles: true }));

        return true;
    }

    for (let i = 0, sL = surveySelect.length; i < sL; i++) {
        if (surveySelect.options[i].text.toString().toLowerCase() == 'yes') {
            surveySelect.selectedIndex = i;
            surveySelect.options[i].selected = true;
            simulateClick(surveySelect);
            break;
        }
    }

    if (configuration['testmode'] == false) {
        const saveNext = saveNextButton();
        setTimeout(() => {
            saveNext.click();
        }, 1000);
        console.log('fetching next...');
    }
}

async function getContactDetails() {
    // Find phone number
    const currentPhoneNumber = (
        document.getElementById('openVpbPhoneLink') ||
        document.getElementById('openvpbphonelink') ||
        Array.from(document.getElementsByTagName('a')).find(
            (a) =>
                a.href.startsWith('tel:') &&
                !DESIGNATED_CONTACT_REGEX.test(a.parentElement.id) &&
                !DESIGNATED_CONTACT_REGEX.test(a.parentElement.parentElement.id)
        ) ||
        {}
    ).innerText;

    let contactName = (document.getElementById('contactName') || {}).innerText;
    contactName = titleCase(contactName);


    const additionalFields = {};
    const detailsSidebar =
        document.getElementById('openvpb-target-details') || document.querySelector('.openvpb-sidebar-fields');

    if (detailsSidebar && detailsSidebar.querySelector('dl')) {
        const dl = detailsSidebar.querySelector('dl');
        const pairs = dl.querySelectorAll('dt, dd');
        let key;
        for (let i = 0; i < pairs.length; i++) {
            if (!key && pairs[i].tagName === 'DT') {
                key = pairs[i].innerText;
            } else if (key && pairs[i].tagName === 'DD') {
                additionalFields[key] = pairs[i].innerText;
                key = null;
            }
        }
    }

    // Figure out if this is a new contact
    if (contactName && currentPhoneNumber) {
        // Log successful calls
        if (saveNextButton()) {
            saveNextButton().addEventListener('click', onSaveNextClick);
        } else {
            console.warn('could not find save next button');
        }

        // Create BYOP Container
        if (!document.getElementById('turbovpbcontainer')) {
            const sidebarContainer =
                document.getElementById('openvpbsidebarcontainer') ||
                document.getElementById('openVpbSideBarContainer');
            if (sidebarContainer) {
                const container = document.createElement('div');
                container.id = 'turbovpbcontainer';
                container.style = 'margin-top: 2rem';
                container.className = 'openvpb-sidebar-content';

                const line = document.createElement('hr');
                line.style = 'margin-bottom: 2rem;';
                container.appendChild(line);

                const title = createTitleElementBYOP();
                container.appendChild(title);
                sidebarContainer.appendChild(container);

                //Check for variant syntax, create variant for this page load
                const scriptText = document.querySelector('[id*=scripttext]').innerText;
                varScriptText = createVariantTemplate(scriptText);
                document.querySelector('[id*=scripttext]').innerHTML = varScriptText;

                //Add VanID to end of message
                let vanID = (document.getElementById('display-fields-value-15') || {}).innerText;
                if(vanID){
                  document.querySelector('[id*=scripttext]').innerHTML += ' ' + vanID;
                }

                let { textPlatform } = await browser.storage.local.get(['textPlatform']);

                if (textPlatform) {
                    console.log('Appending button...');

                    const button = document.createElement('button');
                    button.onclick = () => {
                        // Disable button after it's clicked so only 1 text will be sent at a time
                        button.style.opacity = 0.5;
                        button.style.cursor = 'not-allowed';
                        button.disabled = true;
                        button.title = 'You already set up the text message.';

                        launchMessagingApp(currentPhoneNumber, contactName);
                    };
                    button.style =
                        'width: 100%; height: 38px; background-color: #98BF64; margin-top: 10px; border: none; border-radius: 4px; color: white; font-size: 14px;';
                    button.textContent = 'Set Up Text Message';
                    container.appendChild(button);
                } else {
                    const byopDisabled = document.createElement('div');
                    byopDisabled.style = 'text-align: center; font-style: italic';
                    byopDisabled.innerHTML = 'Select a text platform to continue';
                    container.appendChild(byopDisabled);
                }
            }
        }
    }
}

async function onSaveNextClick() {
    console.log('saving contact result');
    // can we add some sort of check here so we don't advance to the next contact until confirmSent is successful?
    if (firstCall) {
        try {
            firstCall = false;
            const nextCallButton = await waitForButton([
                'firstcallmodalnextcallbutton',
                'firstCallModalNextCallButton'
            ]);
            nextCallButton.click();
            console.log('clicking through first call pop up');
        } catch (err) {
            console.error(err);
        }
    }
}

async function waitForButton(ids, interval = 10, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const untilTimeout = setTimeout(() => {
            reject(new Error(`Could not find buttons: ${ids.join(', ')}`));
        }, timeout);
        const checkInterval = setInterval(() => {
            for (let id of ids) {
                if (document.getElementById(id)) {
                    clearInterval(checkInterval);
                    clearTimeout(untilTimeout);
                    resolve(document.getElementById(id));
                }
            }
        }, interval);
    });
}

function createTitleElementBYOP(tag = 'div') {
    const title = document.createElement(tag);
    title.style = 'text-align: center';
    title.innerHTML = `<svg width="1em" height="1em" viewBox="0 0 16 16" class="bi bi-telephone-outbound-fill"
                fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd"
                    d="M2.267.98a1.636 1.636 0 0 1 2.448.152l1.681 2.162c.309.396.418.913.296 1.4l-.513 2.053a.636.636 0 0 0 .167.604L8.65 9.654a.636.636 0 0 0 .604.167l2.052-.513a1.636 1.636 0 0 1 1.401.296l2.162 1.681c.777.604.849 1.753.153 2.448l-.97.97c-.693.693-1.73.998-2.697.658a17.471 17.471 0 0 1-6.571-4.144A17.47 17.47 0 0 1 .639 4.646c-.34-.967-.035-2.004.658-2.698l.97-.969zM11 .5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V1.707l-4.146 4.147a.5.5 0 0 1-.708-.708L14.293 1H11.5a.5.5 0 0 1-.5-.5z" />
                </svg>`;
    const name = document.createElement('span');
    name.style =
        'padding-left:.3rem; padding-right: .3rem; padding-top: .1rem; font-size: 1.17em; font-weight: bold; color: #000;';
    name.innerText = 'BYOP';
    title.appendChild(name);
    return title;
}
