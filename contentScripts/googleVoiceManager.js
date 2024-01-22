/**
 * This runs on voice.google.com
 */
class GoogleVoiceSiteManager {
    constructor() {
        this.messagesToSend = {};
        this.sendInterval = 5000;
        this.numberQueue = [];
        this.currentNumberSending = '';
    }

    sleep = (ms) => {
        return new Promise(
            resolve => setTimeout(resolve, ms),
        );
    };

    async initialize() {
        const checkUrl = window.location.href;
        //https://voice.google.com/?phoneNo=123456789&sms=Hello
        if (checkUrl.startsWith('https://voice.google.com/')) {
            if (checkUrl.includes('phoneNo') && checkUrl.includes('sms')) {
                this.currentNumberSending = checkUrl.substring(checkUrl.indexOf('phoneNo') + 8, checkUrl.indexOf('&'))
                this.messagesToSend = {
                    [this.currentNumberSending]: decodeURIComponent(checkUrl.substring(checkUrl.indexOf('sms') + 4, checkUrl.length))
                }
                console.log(this.messagesToSend)

                this.sendFromQueueBYOP()
            }
        }
    }

    addMessagesToQueue(messages) {
        Object.assign(this.messagesToSend, messages.messages);
        this.numberQueue = this.numberQueue.concat(messages.queue);
    }

    async sendFromQueue() {
        let retryCount = 2;
        let verifyOnly = false;

        if (this.numberQueue.length > 0) {
            this.currentNumberSending = this.numberQueue.shift();

            let sendExecutionQueue = this.getSendExecutionQueue();
            while (sendExecutionQueue.length) {
                let currentStep = sendExecutionQueue.shift().bind(this);
                const result = await keepTryingAsPromised(currentStep, retryCount > 0);
                if (!result) {
                    console.log(`BYOP SMS - Step failed (${getFunctionName(currentStep)}), retrying message.`);
                    retryCount--; // if this keeps happening, alert on it

                    if (verifyOnly) {
                        sendExecutionQueue = this.getVerificationOnlyExecutionQueue();
                    } else {
                        // otherwise start over in the execution queue
                        sendExecutionQueue = this.getSendExecutionQueue();
                    }
                }
                if (getFunctionName(currentStep) === 'sendMessage') {
                    verifyOnly = true; // we don't want to risk sending a message twice
                }
            }
        }
    }

    async sendFromQueueBYOP() {
        let retryCount = 1;
        let verifyOnly = false;

        let sendExecutionQueue = this.getSendExecutionQueue();
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
                    sendExecutionQueue = this.getVerificationOnlyExecutionQueue();
                } else {
                    // otherwise start over in the execution queue
                    sendExecutionQueue = this.getSendExecutionQueue();
                }
            }
            if (getFunctionName(currentStep) === 'sendMessage') {
                verifyOnly = true; // we don't want to risk sending a message twice
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
        ];
    }

    // opens up the chat again and checks if the message was sent previously
    getVerificationOnlyExecutionQueue() {
        return [
            this.showNumberInput,
            this.fillNumberInput,
            this.startChat,
            this.confirmChatSwitched,
            this.confirmSent
        ];
    }

    showNumberInput() {
        var showInputButton = document.querySelector(selectors.gvNumInputButton);
        if (showInputButton && showInputButton.offsetParent !== null) {
            showInputButton.click();
            return true;
        }
    }

    fillNumberInput() {
        // Confirm that phone number is not already populated in case this is a retry attempt
        if (this.confirmChatSwitched()) {
            return true;
        }

        let numInput = document.querySelector(selectors.gvNumInput);
        if (numInput && numInput.offsetParent !== null) {
            simulateTextEntry(numInput, this.currentNumberSending);

            // confirm that the number was added as expected
            let numInputConfirm = document.querySelector(selectors.gvNumInput);
            return numInputConfirm && numInputConfirm.value === this.currentNumberSending;
        }
    }

    // clicks the "Send to" button on the number dropdown
    startChat() {
        // Confirm that phone number is not already populated in case this is a retry attempt
        if (this.confirmChatSwitched()) {
            return true;
        }

        var startChatButton = document.querySelector(selectors.gvStartChatButton);
        if (startChatButton && startChatButton.offsetParent !== null) {
            startChatButton.click();
            return true;
        }
    }

    // Confirms contact chip is present in the To field
    confirmChatSwitched() {
        const recipientButton = document.querySelector(selectors.gvRecipientButton);
        return recipientButton && recipientButton.offsetParent !== null;
    }

    writeMessage() {
        const number = this.currentNumberSending;
        if (!this.messagesToSend[number]) {
            return false;
        }

        const message = this.messagesToSend[number];
        var messageEditor = document.querySelector(selectors.gvMessageEditor);
        if (messageEditor && messageEditor.offsetParent !== null) {
            // support both div and textarea
            messageEditor.value = message;
            messageEditor.innerText = message;
            return true;
        }
    }

    sendMessage() {
        var messageEditor = document.querySelector(selectors.gvMessageEditor);
        if (!messageEditor) {
            return;
        }

        simulateKeyPress(messageEditor);

        // click send button
        let sendButtonOld = document.querySelector(selectors.gvSendButtonOld);
        let sendButtonNew = document.querySelector(selectors.gvSendButtonNew);
        if (sendButtonOld && sendButtonOld.offsetParent !== null && sendButtonOld.getAttribute('aria-disabled') === 'false') {
            sendButtonOld.click();
            return true;
        }
        if (sendButtonNew && sendButtonNew.offsetParent !== null && sendButtonNew.disabled === false) {
            sendButtonNew.dispatchEvent(new Event('mousedown'));
            sendButtonNew.dispatchEvent(new Event('mouseup'));
            sendButtonNew.click();
            return true;
        }
    }

    confirmThreadHeaderUpdated() {
        let chatLoadedHeader = document.querySelector(selectors.gvChatLoadedHeader);

        // If we move on before this, it can break things
        if (chatLoadedHeader) {
            return true;
        }
    }

    confirmSent() {
        let sendingNote = document.querySelector(selectors.gvSendingNote);

        if (!sendingNote) {
            // check if the message we sent is showing up in the chat window
            let mostRecentMessages = document.querySelectorAll(selectors.gvMostRecentMessages);
            let sentMessageIsThreaded = false;
            if (mostRecentMessages && mostRecentMessages.length) {
                var i = mostRecentMessages.length - 1;
                for (i; !sentMessageIsThreaded && i >= 0; i--) {
                    let messageIntended = removeWhitespace(removeUnicode(this.messagesToSend[this.currentNumberSending]));
                    let messageSent = removeWhitespace(removeUnicode(mostRecentMessages[mostRecentMessages.length - 1].innerText));
                    sentMessageIsThreaded = messageSent === messageIntended;
                }
            }

            if (sentMessageIsThreaded) {
                browser.runtime.sendMessage({ type: "MESSAGE_SENT" });
                // continue with queue
                setTimeout(this.sendFromQueue.bind(this), this.sendInterval);
                return true;
            }
        }
    }
}