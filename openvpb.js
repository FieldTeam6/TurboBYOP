console.log('using openvpb-specific content script')
const DESIGNATED_CONTACT_REGEX = /designated[ _-]?contact/i

let couldntReachContact = false
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

function couldntReachButton() {
    return document.getElementById('displaycontactresultsbutton') ||
        document.getElementById('displayContactResultsButton')
}

function saveNextButton() {
    return document.getElementById('openvpbsavenextbutton') ||
        document.getElementById('openVpbSaveNextButton') ||
        document.getElementById('contactresultssavenextbutton') ||
        document.getElementById('contactResultsSaveNextButton')
}

async function launchMessagingApp(currentPhoneNumber, contactName) {
    let { messageSwitch, yourName, messageTemplates } = await browser.storage.local.get(['messageSwitch', 'yourName', 'messageTemplates']);
    let { label, message, result } = messageTemplates[0];
    let messageBody = message.replace(THEIR_NAME_REGEX, contactName).replace(YOUR_NAME_REGEX, yourName);
+   console.log('messageBody', messageBody);

    if (configuration['testmode'] == true){
        currentPhoneNumber = configuration['defaultNumber']
    }

    if (messageSwitch) {
        //open google voice if messageSwitch is true
        let digitsOnlyPhoneNumber = currentPhoneNumber.replace(/\D+/g, "")
        console.log(`https://voice.google.com/u/0/messages/?phoneNo=${digitsOnlyPhoneNumber}&sms=${encodeURIComponent(messageBody)}`)
        window.open(`https://voice.google.com/u/0/messages/?phoneNo=${digitsOnlyPhoneNumber}&sms=${encodeURIComponent(messageBody)}`, '_blank');
    } else {
        //open default messaging app if messageSwitch is false
        console.log(`sms://${currentPhoneNumber};?&body=${encodeURIComponent(messageBody)}`)
        window.open(`sms://${currentPhoneNumber};?&body=${encodeURIComponent(messageBody)}`, '_blank');
    }
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
        couldntReachContact = false

        // Determine if they couldn't reach the contact
        if (couldntReachButton()) {
            couldntReachButton().addEventListener('click', async() => {
                couldntReachContact = true
                console.log(`couldn't reach contact: ${couldntReachContact}`)

                const [cancelButton, saveNextButton] = await Promise.all([
                    waitForButton(['contactresultscancelbutton', 'contactResultsCancelButton']),
                    waitForButton(['contactresultssavenextbutton', 'contactResultsSaveNextButton'])
                ])
                cancelButton.addEventListener('click', () => {
                    couldntReachContact = false
                    console.log(`couldn't reach contact: ${couldntReachContact}`)
                })
                saveNextButton.addEventListener('click', onSaveNextClick)
            })
        } else {
            console.warn('could not find couldn\'t reach button')
        }

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

                let { yourName, messageTemplates } = await browser.storage.local.get(['yourName', 'messageTemplates'])

                if (messageTemplates.length > 0) {
                    console.log('Appending button...')

                    const button = document.createElement('button')
                    button.onclick = () => {
                        launchMessagingApp(currentPhoneNumber, contactName);
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

                        if(configuration['testmode'] == false){
                            const saveNext = saveNextButton();
                            setTimeout(() => {
                                saveNext.click()
                            }, 1000)
                            console.log('fetching next...')
                        }
                    }
                    button.style = 'width: 100%;height: 38px;background-color: #98BF64;margin-top: 10px;border: none;border-radius: 4px;cursor: pointer;color: white;font-size: 14px;'
                    button.textContent = "Set Up Text Message"
                    container.appendChild(button)
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
            let element
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
