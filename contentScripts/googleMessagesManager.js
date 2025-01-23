/**
 * This runs on textfree.us
 */
class GoogleMessagesManager {
    constructor() {
        this.messagesToSend = {};
        this.errorActions = {};
        this.sendInterval = 5000;
        this.numberQueue = [];
        this.currentNumberSending = '';
        this.throttled = false;
        this.openVpbUrl = ''; 
    }

    async initialize() {
        browser.runtime.onMessage.addListener((message) => {
            if (message.type === 'SEND_MESSAGE') {
                this.currentNumberSending = message.phoneNumber;
                this.currentContactName = message.contactName;
                this.messagesToSend = {
                    [this.currentNumberSending]: message.message
                };
                this.openVpbUrl = message.openVpbUrl;
                this.sendFromQueueBYOP();
            }

            if (message.type === 'FIND_CONTACT') {
                findContact(message.contactName);
            }
        });
    }

    // Clicks on the New Message button
    showNumberInput() {
        const startChatButton = document.querySelector(selectors.gmStartChatButton);

        if (startChatButton) {
            startChatButton.click();

            if (document.querySelector(selectors.gmNumInput)) { 
                return true;
            }
        }
        return false;
    }

    // Enters phone number in the phone number field
    fillNumberInput() {
        const numInput = document.querySelector(selectors.gmNumInput);

        if (numInput) {
            console.log('numInput', numInput);
            numInput.value = this.currentNumberSending.replace(/\D/g, '');
            simulateInputChange(numInput);
        }
        
        return checkElementValue(this.currentNumberSending, numInput);
    }

    // clicks the "Send to" button on the number dropdown
    startChat() {
        var startChatButton = document.querySelector(selectors.gmSendToButton)
        if (startChatButton && startChatButton.offsetParent !== null) {
            startChatButton.click()
            return true
        }
    }

    // Confirms contact chip is present in the To field
    confirmChatSwitched() {
        const recipientButton = document.querySelector(selectors.gmToChip)
        return recipientButton && recipientButton.offsetParent !== null
    }

    // Enters message in the message field
    writeMessage() {
        const message = this.messagesToSend[this.currentNumberSending];

        if (!message) {
            return false;
        }

        const messageEditor = document.querySelector(selectors.gmMessageEditor);

        if (messageEditor) {
            simulateTextEntry(messageEditor, message);
            return checkElementValue(message, messageEditor);
        }
    }

    // Clicks the send button
    sendMessage() {
        let sendButton = document.querySelector(selectors.gmSendButton);
        if (sendButton && sendButton.disabled === false) {
            sendButton.click();
            return true;
        }
        return false;
    }

    // Confirms message was sent
    confirmSent() {
        const sentMessages = document.querySelectorAll(selectors.gmSentMessages);

        if (sentMessages) {
            const lastSentMessage = sentMessages[sentMessages.length - 1];
            if (checkElementValue(this.messagesToSend[this.currentNumberSending], lastSentMessage)) {
                this.throttled = false;
                return true;
            }
        }

        this.throttled = true;
        return false;
    }

    goBackToOpenVPBTab() {
        console.log('going back to OpenVPBTab');
        browser.runtime.sendMessage({ type: 'MESSAGE_SENT' });

        // Switch to OpenVPB tab and save contact
        browser.runtime.sendMessage({
            type: 'SWITCH_TAB',
            url: this.openVpbUrl
        });
        browser.runtime.sendMessage({
            type: 'TALK_TO_TAB',
            url: this.openVpbUrl,
            tabType: 'RECORD_TEXT_IN_DB'
        });
        return true;
    }

    verifyChat() {
        // Check if phone number and sent message are correct
        if (checkElementValue(this.currentNumberSending, document.querySelector(selectors.tfNewMessageToInput)) &&
            checkElementValue(this.messagesToSend[this.currentNumberSending], document.querySelector(selectors.tfSentMessageBubble))) {
            console.log('chat verified');
            return true;
        }
        return false;
    }

    getSendExecutionQueue() {
        return [
            this.showNumberInput,
            this.fillNumberInput,
            this.startChat,
            this.confirmChatSwitched,
            this.writeMessage,
            this.sendMessage,
            this.confirmSent,
            //this.goBackToOpenVPBTab
        ];
    }

    async sendFromQueueBYOP(queueNum = 0) {
        let sendExecutionQueue = this.getSendExecutionQueue();
        // Queue is finished
        if (queueNum === sendExecutionQueue.length) return;

        let currentStep = sendExecutionQueue[queueNum].bind(this);
        const currentStepName = getFunctionName(currentStep);
        console.log('BYOP SMS - Running: ', currentStepName);

        if (currentStepName === 'confirmSent' && this.throttled) {
            this.errorActions[currentStepName] = () =>
                showFatalError(
                    `You've been throttled by TextFree. Please wait 24 hours and try again.\n\nError: "${functionName}" failed.`,
                    false
                );
            this.throttled = false;
        }
        // If the current step is before the final step (switching back to OpenVPB tab)
        else if (queueNum < sendExecutionQueue.length - 1) {
            this.errorActions[currentStepName] = () =>
                showFatalError(
                    `If the problem persists, please report the error in the BYOP Slack channel or via the help link in the extension popup.\n\nError: "${currentStepName}" failed.`,
                    false
                );
        }

        tryStep(currentStep, () => {
            if (currentStepName === 'sendMessage') {
                // waits to call confirmSent step to allow time for the 
                // message to send and see if we've been throttled
                setTimeout(() => {
                    this.sendFromQueueBYOP(queueNum + 1);
                }, 1000); 
            } else {
                this.sendFromQueueBYOP(queueNum + 1);
            }
        }, this.errorActions, 20, 500);
    }
}
