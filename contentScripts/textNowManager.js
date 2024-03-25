/**
 * This runs on https://www.textnow.com/messaging
 */
class TextNowSiteManager {
    constructor() {
        this.messagesToSend = {};
        this.errorActions = {};
        this.sendInterval = 5000;
        this.numberQueue = [];
        this.currentNumberSending = '';
    }

    async initialize() {
        browser.runtime.onMessage.addListener((message) => {
            if (message.type === 'SEND_MESSAGE') {
                this.currentNumberSending = message.phoneNumber;
                this.currentContactName = message.contactName;
                this.messagesToSend = {
                    [this.currentNumberSending]: message.message
                };
                this.sendFromQueueBYOP();
            }

            if (message.type === 'FIND_CONTACT') {
                findContact(
                    message.contactName,
                    '.chat-preview-list',
                    '.uikit-summary-list__cell',
                    '.js-conversation-name'
                );
            }
        });
    }

    // Clicks on the New Message button
    showNumberInput() {
        if (this.verifyChat()) return true;
        const startChatButton = document.querySelector(selectors.tnStartChatButton);
        if (startChatButton) {
            console.log('starting chat');
            startChatButton.click();
            if (document.querySelector(selectors.tnNumInput)) return true;
        }
        return false;
    }

    // Enters phone number in the phone number field
    fillNumberInput() {
        if (this.verifyChat()) return true;
        console.log('entering phone number');
        return fillElementAndCheckValue(
            `+1${this.currentNumberSending.replace(/\D/g, '')}`,
            document.querySelector(selectors.tnNumInput),
            document.querySelector(selectors.tnNewMessageToInput)
        );
    }

    // Enters message in the message field
    writeMessage() {
        if (this.verifyChat()) return true;
        console.log('writing message');
        const message = this.messagesToSend[this.currentNumberSending];
        if (!message) {
            return false;
        }

        return fillElementAndCheckValue(message, document.querySelector(selectors.tnMessageEditor));
    }

    // Clicks the send button
    sendMessage() {
        if (this.verifyChat()) return true;
        let sendButton = document.querySelector(selectors.tnSendButton);
        if (sendButton) {
            console.log('clicking send button');
            sendButton.click();
            return true;
        }
        return false;
    }

    // Confirms message was sent
    confirmSent() {
        console.log('confirming sent');
        return document.querySelector(selectors.tnMessageBubble) ? true : false;
    }

    goBackToOpenVPBTab() {
        console.log('going back to OpenVPBTab');
        browser.runtime.sendMessage({ type: 'MESSAGE_SENT' });

        // Switch to OpenVPB tab and save contact
        browser.runtime.sendMessage({
            type: 'SWITCH_TAB',
            url: 'https://www.openvpb.com/VirtualPhoneBank*'
        });
        browser.runtime.sendMessage({
            type: 'TALK_TO_TAB',
            url: 'https://www.openvpb.com/VirtualPhoneBank*',
            tabType: 'RECORD_TEXT_IN_DB'
        });
        return true;
    }

    verifyChat() {
        // Check if phone number and sent message are correct
        if (
            checkElementValue(this.currentNumberSending, document.querySelector(selectors.tnNewMessageToInput)) &&
            checkElementValue(
                this.messagesToSend[this.currentNumberSending],
                document.querySelector(selectors.tnMessageBubble)
            )
        ) {
            console.log('chat verified');
            return true;
        }
        return false;
    }

    getSendExecutionQueue() {
        return [
            this.showNumberInput,
            this.fillNumberInput,
            this.writeMessage,
            this.sendMessage,
            this.confirmSent,
            this.goBackToOpenVPBTab
        ];
    }

    async sendFromQueueBYOP(queueNum = 0) {
        let sendExecutionQueue = this.getSendExecutionQueue();
        // Queue is finished
        if (queueNum === sendExecutionQueue.length) return;

        let currentStep = sendExecutionQueue[queueNum].bind(this);
        const currentStepName = getFunctionName(currentStep);

        // If the current step is before the final step (switching back to OpenVPB tab)
        if (queueNum < sendExecutionQueue.length - 1) {
            this.errorActions[currentStepName] = () =>
                showFatalError(
                    `Please check your network connection and try reloading the page and clicking Set Up Text Message again.\n\nIf the problem persists, please report the error in the BYOP Slack channel or via the help link in the extension popup.\n\nError: "${currentStepName}" failed.`,
                    false
                );
        }

        tryStep(
            currentStep,
            () => this.sendFromQueueBYOP(queueNum + 1),
            this.errorActions,
            currentStepName === 'showNumberInput' || currentStepName === 'confirmSent' ? 10 : 3
        );
    }
}
