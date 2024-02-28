console.log('using openvpb-specific content script')
const DESIGNATED_CONTACT_REGEX = /designated[ _-]?contact/i

// OpenVPB displays a pop-up after you make your first call
// This is annoying for the BYOP experience because it looks like
// it's not loading the next contact right away. So, we just click through
// that popup
let firstCall = true

const THEIR_NAME_REGEX = /[\[\(\{<]+\s*(?:their|thier|there)\s*name\s*[\]\)\}>]+/ig
const YOUR_NAME_REGEX = /[\[\(\{<]+\s*(?:your|y[ou]r|you'?re|my)\s*name\s*[\]\)\}>]+/ig

const configuration = {
    "testmode": false,
    "defaultNumber": '1234567890'
}

setInterval(getContactDetails, 50)

function saveNextButton() {
    return document.getElementById('openvpbsavenextbutton') ||
        document.getElementById('openVpbSaveNextButton') ||
        document.getElementById('contactresultssavenextbutton') ||
        document.getElementById('contactResultsSaveNextButton')
}

async function launchMessagingApp(currentPhoneNumber, contactName) {
    let { messageSwitch, yourName, messageTemplates, throttledSendCount } = await browser.storage.local.get(['messageSwitch', 'yourName', 'messageTemplates', 'throttledSendCount']);
    let { label, message, result } = messageTemplates[0];
    let messageBody = message.replace(THEIR_NAME_REGEX, contactName).replace(YOUR_NAME_REGEX, yourName);
    const sendHistory = await getSendHistory();    
    const currentSendCount = sendHistory ? sendHistory.length : 0;

    console.log('messageBody', messageBody);
    console.log('throttledSendCount', throttledSendCount);
    console.log('currentSendCount', currentSendCount);
    let showAlert = throttledSendCount && currentSendCount >= throttledSendCount;

    if (showAlert) {
        var continueTexting = confirm("You've been throttled by Google Voice.\n\nIf you'd like to attempt to send another text, click \"OK.\"  Otherwise, click \"Cancel\" to quit or try a different campaign.");
         
        if (!continueTexting) {
            return false;
        }
    }

    if (configuration['testmode'] == true){
        currentPhoneNumber = configuration['defaultNumber']
    }

    if (messageSwitch) {
        //open google voice if messageSwitch is true
        let digitsOnlyPhoneNumber = currentPhoneNumber.replace(/\D+/g, "")
        const targetUrl = `https://voice.google.com/u/0/messages?phoneNo=${digitsOnlyPhoneNumber}&sms=${encodeURIComponent(messageBody)}`;
        console.log(targetUrl)
        window.open(targetUrl, '_blank');
    } else {
        //open default messaging app if messageSwitch is false
        const targetUrl = `sms://${currentPhoneNumber};?&body=${encodeURIComponent(messageBody)}`;
        console.log(targetUrl)
        window.open(targetUrl, '_blank');
        browser.runtime.sendMessage({ type: "MESSAGE_SENT" });
    }

    return true;
}

async function getContactDetails() {
    // Find phone number
    const currentPhoneNumber = (document.getElementById('openVpbPhoneLink') ||
        document.getElementById('openvpbphonelink') ||
        Array.from(document.getElementsByTagName('a'))
        .find((a) => a.href.startsWith('tel:') && !DESIGNATED_CONTACT_REGEX.test(a.parentElement.id) && !DESIGNATED_CONTACT_REGEX.test(a.parentElement.parentElement.id)) || {}).innerText

    const contactName = (document.getElementById('contactName') || {}).innerText

    const additionalFields = {}
    const detailsSidebar = document.getElementById('openvpb-target-details') || document.querySelector('.openvpb-sidebar-fields')
    if (detailsSidebar && detailsSidebar.querySelector('dl')) {
        const dl = detailsSidebar.querySelector('dl')
        const pairs = dl.querySelectorAll('dt, dd')
        let key
        for (let i = 0; i < pairs.length; i++) {
            if (!key && pairs[i].tagName === 'DT') {
                key = pairs[i].innerText
            } else if (key && pairs[i].tagName === 'DD') {
                additionalFields[key] = pairs[i].innerText
                key = null
            }
        }
    }

    // Figure out if this is a new contact
    if (contactName && currentPhoneNumber && isNewContact(currentPhoneNumber)) {
        // Log successful calls
        if (saveNextButton()) {
            saveNextButton().addEventListener('click', onSaveNextClick)
        } else {
            console.warn('could not find save next button')
        }

        // Create BYOP Container
        if (!document.getElementById('turbovpbcontainer')) {
            const sidebarContainer = document.getElementById('openvpbsidebarcontainer') || document.getElementById('openVpbSideBarContainer')
            if (sidebarContainer) {
                const container = document.createElement('div')
                container.id = "turbovpbcontainer"
                container.style = "margin-top: 2rem"
                container.className = "openvpb-sidebar-content"

                const line = document.createElement('hr')
                line.style = 'margin-bottom: 2rem;'
                container.appendChild(line)

                const title = createTitleElementBYOP()
                container.appendChild(title)
                sidebarContainer.appendChild(container)

                let { messageTemplates, throttledSendCount = 0 } = await browser.storage.local.get(['messageTemplates', 'throttledSendCount']);
                var sendHistory = await getSendHistory();
                var currentSendCount = sendHistory.length;
                //console.log('throttledSendCount', throttledSendCount);
                //console.log('currentSendCount', currentSendCount);

                if (messageTemplates && messageTemplates.length > 0) {
                    console.log('Appending button...')
                    const button = document.createElement('button')
                    button.onclick = async () => {
                        const markTexted = await launchMessagingApp(currentPhoneNumber, contactName);
                        if (markTexted) {

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
                                if ((surveySelect.options[i].text).toString().toLowerCase() == 'yes') {
                                    surveySelect.selectedIndex = i;
                                    surveySelect.options[i].selected = true;
                                    simulateClick(surveySelect);
                                    break;
                                }
                            }

                            if (configuration['testmode'] == false) {
                                const saveNext = saveNextButton();
                                setTimeout(() => {
                                    saveNext.click()
                                }, 1000)
                                console.log('fetching next...')
                            }
                        }
                    }

                    button.style = 'width: 100%;height: 38px;background-color: #98BF64;margin-top: 10px;border: none;border-radius: 4px;cursor: pointer;color: white;font-size: 14px;'
                    button.textContent = "Set Up Text Message"

                    if (!throttledSendCount) {
                        container.appendChild(button)
                    } else if (currentSendCount < throttledSendCount) {
                        container.appendChild(button)
                        browser.storage.local.set({ throttledSendCount: 0 });
                    }
                } else {
                    console.log('NO msg templates')
                }
            }
        }
        storeContactDataInSessionStorage(
            contactName,
            currentPhoneNumber,
            additionalFields
        )
    }
}

async function onSaveNextClick() {
    console.log('saving contact result')
    // can we add some sort of check here so we don't advance to the next contact until confirmSent is successful?

    if (firstCall) {
        firstCall = false
        const nextCallButton = await waitForButton(['firstcallmodalnextcallbutton', 'firstCallModalNextCallButton'])
        nextCallButton.click()
        console.log('clicking through first call pop up')
    }
}

async function waitForButton(ids, interval = 10, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const untilTimeout = setTimeout(() => {
            reject(new Error(`Could not find buttons: ${ids.join(', ')}`))
        }, timeout)
        const checkInterval = setInterval(() => {
            for (let id of ids) {
                if (document.getElementById(id)) {
                    clearInterval(checkInterval)
                    clearTimeout(untilTimeout)
                    resolve(document.getElementById(id))
                }
            }
        }, interval)
    })
}
