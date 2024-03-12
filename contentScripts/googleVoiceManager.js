/**
 * This runs on voice.google.com
 */
class GoogleVoiceSiteManager {
    constructor() {
        this.messagesToSend = {}
        this.sendInterval = 5000
        this.numberQueue = []
        this.currentNumberSending = ''
    }

    sleep = (ms) => {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    async initialize() {
        const checkUrl = window.location.href;

        // https://voice.google.com/u/0/messages?phoneNo=123456789&sms=Hello
        if (checkUrl.startsWith('https://voice.google.com/')) {
            const urlParams = new URLSearchParams(window.location.search);

            if (urlParams.has('phoneNo') && urlParams.has('sms')) {
                this.currentNumberSending = urlParams.get('phoneNo');
                this.messagesToSend = { 
                    [this.currentNumberSending]: decodeURIComponent(urlParams.get('sms'))
                };
                console.log('messagesToSend', this.messagesToSend)

                this.sendFromQueueBYOP()
            }
        }

        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'SEND_MESSAGE') {
                this.currentNumberSending = message.phoneNumber
                this.currentContactName = message.contactName
                const currentContactFirstName = this.currentContactName.split(' ')[0]
                this.messagesToSend = {
                    [this.currentNumberSending]: message.message.replace(
                        this.currentContactName,
                        currentContactFirstName
                    )
                }
                this.sendFromQueueBYOP()
            }
            if (message.type === 'FIND_CONTACT') {
                findContact(message.contactName)
            }
        })
    }

    async sendFromQueue() {
        let retryCount = 2
        let verifyOnly = false

        if (this.numberQueue.length > 0) {
            this.currentNumberSending = this.numberQueue.shift();
            let sendExecutionQueue = this.getSendExecutionQueue();

            while (sendExecutionQueue.length) {
                let currentStep = sendExecutionQueue.shift().bind(this);
                const result = await keepTryingAsPromised(currentStep, retryCount > 0);

                if (!result) {
                    console.log(`BYOP SMS - Step failed (${getFunctionName(currentStep)}), retrying message.`)
                    retryCount-- // if this keeps happening, alert on it

                    if (verifyOnly) {
                        sendExecutionQueue = this.getVerificationOnlyExecutionQueue()
                    } else {
                        // otherwise start over in the execution queue
                        sendExecutionQueue = this.getSendExecutionQueue()
                    }
                }
                
                if (getFunctionName(currentStep) === 'sendMessage') {
                    verifyOnly = true // we don't want to risk sending a message twice
                }
            }
        }
    }

    async sendFromQueueBYOP() {
        let retryCount = 1;
        let verifyOnly = false;

        let sendExecutionQueue = this.getSendExecutionQueue()
        while (sendExecutionQueue.length) {
            let currentStep = sendExecutionQueue.shift().bind(this);
            const result = await keepTryingAsPromised(currentStep, retryCount > 0);

            if (!result) {
                if (getFunctionName(currentStep) === 'confirmSent') {
                    // We don't retry confirmSent failures as they almost always indicate throttling
                    console.log(`${retryCount}: BYOP SMS - Step failed (${getFunctionName(currentStep)}).`);
                } else {
                    console.log(`${retryCount}: BYOP SMS - Step failed (${getFunctionName(currentStep)}), retrying message.`);
                }

                retryCount--; // if this keeps happening, alert on it

                if (verifyOnly) {
                    sendExecutionQueue = this.getVerificationOnlyExecutionQueue()
                } else {
                    // otherwise start over in the execution queue
                    sendExecutionQueue = this.getSendExecutionQueue()
                }
            }
            if (getFunctionName(currentStep) === 'sendMessage') {
                verifyOnly = true // we don't want to risk sending a message twice
            }
        }
    }

    getSendExecutionQueue() {
        return [
            this.showNumberInput,
            this.fillNumberInput,
            this.startChat,
            this.confirmChatSwitched,
            this.writeMessage,
            this.sendMessage,
            this.confirmThreadHeaderUpdated,
            this.confirmSent
        ]
    }

    // opens up the chat again and checks if the message was sent previously
    getVerificationOnlyExecutionQueue() {
        return [this.showNumberInput, this.fillNumberInput, this.startChat, this.confirmChatSwitched, this.confirmSent]
    }

    showNumberInput() {
        var showInputButton = document.querySelector(selectors.gvNumInputButton)
        console.log('showInputButton', showInputButton);
        if (showInputButton && showInputButton.offsetParent !== null) {
            showInputButton.click()
            return true
        }
    }

    fillNumberInput() {
        // Confirm that phone number is not already populated in case this is a retry attempt
        if (this.confirmChatSwitched()) {
            return true
        }

        let numInput = document.querySelector(selectors.gvNumInput)
        if (numInput && numInput.offsetParent !== null) {
            simulateTextEntry(numInput, this.currentNumberSending)

            // confirm that the number was added as expected
            let numInputConfirm = document.querySelector(selectors.gvNumInput)
            return numInputConfirm && numInputConfirm.value === this.currentNumberSending
        }
    }

    // clicks the "Send to" button on the number dropdown
    startChat() {
        // Confirm that phone number is not already populated in case this is a retry attempt
        if (this.confirmChatSwitched()) {
            return true
        }

        var startChatButton = document.querySelector(selectors.gvStartChatButton)
        if (startChatButton && startChatButton.offsetParent !== null) {
            startChatButton.click()
            return true
        }
    }

    // Confirms contact chip is present in the To field
    confirmChatSwitched() {
        const recipientButton = document.querySelector(selectors.gvRecipientButton)
        return recipientButton && recipientButton.offsetParent !== null
    }

    writeMessage() {
        const number = this.currentNumberSending;

        if (!this.messagesToSend[number]) {
            return false
        }

        const message = this.messagesToSend[number];
        var messageEditor = document.querySelector(selectors.gvMessageEditor);

        if (messageEditor && messageEditor.offsetParent !== null) {
            // support both div and textarea
            simulateTextEntry(messageEditor, message);
            return true;
        }
    }

    sendMessage() {
        var messageEditor = document.querySelector(selectors.gvMessageEditor)
        if (!messageEditor) {
            return
        }

        // click send button
        let sendButtonNew = document.querySelector(selectors.gvSendButton);
        if (sendButtonNew && sendButtonNew.offsetParent !== null && sendButtonNew.disabled === false) {
            sendButtonNew.click();
            return true;
        }
    }

    confirmThreadHeaderUpdated() {
        let chatLoadedHeader = document.querySelector(selectors.gvChatLoadedHeader)

        // If we move on before this, it can break things
        if (chatLoadedHeader) {
            return true
        }
    }

    confirmSent() {
        let sendingNote = document.querySelector(selectors.gvSendingNote)

        if (!sendingNote) {
            // check if the message we sent is showing up in the chat window
            let mostRecentMessages = document.querySelectorAll(selectors.gvMostRecentMessages)
            let sentMessageIsThreaded = false
            if (mostRecentMessages && mostRecentMessages.length) {
                var i = mostRecentMessages.length - 1;

                for (i; !sentMessageIsThreaded && i >= 0; i--) {
                    let messageIntended = removeWhitespace(
                        removeUnicode(this.messagesToSend[this.currentNumberSending])
                    )
                    let messageSent = removeWhitespace(
                        removeUnicode(mostRecentMessages[mostRecentMessages.length - 1].innerText)
                    )
                    sentMessageIsThreaded = messageSent === messageIntended
                }
            }

            if (sentMessageIsThreaded) {
                chrome.runtime.sendMessage({ type: 'MESSAGE_SENT' })
                // Switch to OpenVPB tab and record text in db
                chrome.runtime.sendMessage({
                    type: 'SWITCH_TAB',
                    url: 'https://www.openvpb.com/VirtualPhoneBank*'
                })
                chrome.runtime.sendMessage({
                    type: 'TALK_TO_TAB',
                    url: 'https://www.openvpb.com/VirtualPhoneBank*',
                    tabType: 'RECORD_TEXT_IN_DB'
                })
                // continue with queue
                setTimeout(this.sendFromQueue.bind(this), this.sendInterval)
                return true
            }
        }
    }
}
