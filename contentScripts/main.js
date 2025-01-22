const siteIsGoogleVoice = window.location.href.startsWith('https://voice.google.com');
const siteIsGoogleMessages = window.location.href.startsWith('https://messages.google.com')
const siteIsTextFree = window.location.href.startsWith('https://messages.textfree.us');
let siteManager; // globally available

// all of the selectors used for automation
const selectors = {
    // google voice (in cases where there are two selectors, it is to support newer versions to older versions, left to right)
    gvMessagesTab: 'a[gv-test-id="sidenav-messages"]',
    gvNumInputButton: 'div[gv-id="send-new-message"]',
    gvNumInput:
        'gv-recipient-picker input[ng-show="ctrl.allowToAddRecipients()"], input[placeholder="Type a name or phone number"]',
    gvSendToButton:
        '#send_to_button-0, gv-contact-list-ng2 .send-to-button, gv-contact-list div[ng-class="::ctrl.CSS.SEND_TO_PHONE_NUMBER"]',
    gvToChip:
        'mat-chip-row, gmat-input-chip[gv-id="chip-phone-number"], div[aria-label="Select recipients"] md-chips md-chip button',
    gvMessageEditor:
        'textarea[gv-test-id="gv-message-input"], textarea[placeholder="Type a message"], textarea[aria-label="Add a caption"], #gv-message-input, div[gv-test-id="gv-message-input"]',
    gvSendButton: 'button[aria-label="Send message"]',
    // this is the note that says "Sending" after clicking the send button; it will disappear when it is finished
    gvSendingNote: 'gv-message-item div[ng-if="ctrl.shouldDisplayTransmissionStatus()"] div[ng-if="!ctrl.isFailed()"]',
    gvMostRecentMessages:
        'div[gv-id="content"] div[gv-test-id="bubble"] gv-annotation, gv-text-message-item gv-annotation',
    // the header switches to this after sending is complete
    gvChatLoadedHeader: 'gv-message-list-header p[gv-test-id="conversation-title"] div.primary-text',

    // TextFree selectors
    tfAccountVerify: '.account-verify, h5[data-testid="account-verification-modal-title"]',
    tfRenameButton: '.contact.is-selected #renameButton',
    tfSentMessageBubble: '.sent-message',
    tfMessageEditor: 'textarea[id^="ion-textarea-"]',
    tfName: '.contact.is-selected .name',
    tfNewMessageToInput: '.tag.state--address',
    tfNumInput: '.native-input',
    tfOptionsMenuDropdownArrow: '.contact.is-selected #optionsButton:not(.rotate-element)',
    tfEditNameInput: '.contact.is-selected .edit-name',
    tfSendButton: '#submitConversation:not([disabled])',
    tfStartChatButton: '[data-testid=startNewConversationButton]',

    // Google messages
    gmStartChatButton: 'a.mdc-button',
    gmNumInput: 'input.input',
    gmSendToButton: 'mw-contact-selector-button button',
    gmToChip: 'div.title-container h2',
    gmMessageEditor: 'textarea.input',
    gmSendButton: 'button.send-button',
    gmSentMessages: 'div.text-msg'
};

function findGoogleMessages() {
    // stop looking, wrong url
    console.log('findGoogleMessages', window.location.href);
    if (!siteIsGoogleMessages) {
        showFatalError('Could not find Google Messages!', false);
        return false;
    }

    // Wait for the Start Chat button to load before starting the process to send the text
    waitForElementToLoad(selectors.gmStartChatButton)
        .then(() => {
            console.log('configuring Google Messages site');
            siteManager = new GoogleMessagesManager();
            siteManager.initialize();
        })
        .catch((err) => {
            console.error(err);
            showFatalError('Please try reloading the page and click Set Up Text Message again.', false);
        });
}

function findGoogleVoice() {
    // stop looking, wrong url
    console.log('findGoogleVoice', window.location.href);
    if (!siteIsGoogleVoice) {
        showFatalError('Could not find Google Voice!', false);
        return false;
    }

    // check if this is the google voice site
    var button = document.querySelector(selectors.gvMessagesTab);

    if (button && siteIsGoogleVoice) {
        console.log('configuring Google Voice site');
        siteManager = new GoogleVoiceSiteManager();
        siteManager.initialize();
        return true;
    }

    return false;
}

function findTextFree() {
    // stop looking, wrong url
    console.log('findTextFree', window.location.href);
    if (!siteIsTextFree) {
        showFatalError('Could not find TextFree!', false);
        return false;
    }

    // Wait for the Start Chat button to load before starting the process to send the text
    waitForElementToLoad(selectors.tfStartChatButton)
        .then(() => {
            console.log('configuring TextFree site');
            siteManager = new TextFreeSiteManager();
            siteManager.initialize();
        })
        .catch((err) => {
            console.error(err);
            showFatalError('Please try reloading the page and click Set Up Text Message again.', false);
        });
}

async function chooseTextPlatform() {
    const { textPlatform } = await browser.storage.local.get(['textPlatform']);
    if (textPlatform === 'google-messages') findGoogleMessages();
    if (textPlatform === 'google-voice') keepTryingAsPromised(findGoogleVoice, true);
    if (textPlatform === 'text-free') findTextFree();
}

chooseTextPlatform();
