const siteIsGoogleVoice = window.location.href.startsWith('https://voice.google.com')
const siteIsTextFree = window.location.href.startsWith('https://messages.textfree.us/conversation')
let siteManager // globally available

// all of the selectors used for automation
const selectors = {
    // google voice (in cases where there are two selectors, it is to support newer versions to older versions, left to right)
    gvMessagesTab: 'a[gv-test-id="sidenav-messages"]',
    gvNumInputButton: 'div[gv-id="send-new-message"]',
    gvNumInput: 'gv-recipient-picker input[ng-show="ctrl.allowToAddRecipients()"], input[placeholder="Type a name or phone number"]',
    gvStartChatButton: '#send_to_button-0, gv-contact-list-ng2 .send-to-button, gv-contact-list div[ng-class="::ctrl.CSS.SEND_TO_PHONE_NUMBER"]',
    gvRecipientButton: 'mat-chip-row, gmat-input-chip[gv-id="chip-phone-number"], div[aria-label="Select recipients"] md-chips md-chip button',
    gvMessageEditor: 'textarea[gv-test-id="gv-message-input"], textarea[placeholder="Type a message"], textarea[aria-label="Add a caption"], #gv-message-input, div[gv-test-id="gv-message-input"]',
    gvSendButton: 'button[aria-label="Send message"]',
    // this is the note that says "Sending" after clicking the send button; it will disappear when it is finished
    gvSendingNote: 'gv-message-item div[ng-if="ctrl.shouldDisplayTransmissionStatus()"] div[ng-if="!ctrl.isFailed()"]',
    gvMostRecentMessages:
        'div[gv-id="content"] div[gv-test-id="bubble"] gv-annotation, gv-text-message-item gv-annotation',
    // the header switches to this after sending is complete
    gvChatLoadedHeader: 'gv-message-list-header p[gv-test-id="conversation-title"]',

    // TextFree selectors
    tfRenameButton: '.contact.is-selected #renameButton',
    tfMessageBubble: '.sent-message',
    tfMessageEditor: '.emojionearea-editor',
    tfName: '.contact.is-selected .name',
    tfNewMessageToInput: '.new-message-to-input',
    tfNumInput: '#contactInput',
    tfOptionsMenuDropdownArrow: '.contact.is-selected #optionsButton:not(.rotate-element)',
    tfEditNameInput: '.contact.is-selected .edit-name',
    tfSendButton: '#sendButton',
    tfStartChatButton: '#startNewConversationButton'
}

function findGoogleVoice() {
    // stop looking, wrong url
    if (!window.location.href.startsWith('https://voice.google.com')) {
        console.log('could not find google voice!')
        return false
    }

    // check if this is the google voice site
    var button = document.querySelector(selectors.gvMessagesTab)
    console.log('button', button)
    console.log('siteIsGoogleVoice', siteIsGoogleVoice);
    if (button && siteIsGoogleVoice) {
        console.log('configuring google voice site')
        siteManager = new GoogleVoiceSiteManager()
        siteManager.initialize()
        return true
    }

    return false
}

function findTextFree() {
    // stop looking, wrong url
    if (!siteIsTextFree) {
        showFatalError(
            `Please make sure you select the correct texting platform in the BYOP popup window and are using the correct texting platform.`,
            false
        )
    }

    // Wait for the Start Chat button to load before starting the process to send the text
    waitForElementToLoad(selectors.tfStartChatButton)
        .then(() => {
            console.log('configuring TextFree site')
            siteManager = new TextFreeSiteManager()
            siteManager.initialize()
        })
        .catch((err) => {
            console.error(err)
            showFatalError(`Please try re-loading the page and click Set Up Text Message again.`, true)
        })
}

async function chooseTextPlatform() {
    let { textPlatform } = await chrome.storage.local.get(['textPlatform'])
    if (textPlatform === 'google-voice') keepTryingAsPromised(findGoogleVoice, true)
    if (textPlatform === 'text-free') findTextFree()
}

chooseTextPlatform()
