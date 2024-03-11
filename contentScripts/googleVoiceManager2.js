/**
 * This runs on voice.google.com
 */
class GoogleVoiceSiteManager2 {
    constructor() {
        this.messagesToSend = {}
        this.errorActions = {}
        this.sendInterval = 5000
        this.numberQueue = []
        this.currentNumberSending = ''
    }

    async initialize() {
        const checkUrl = window.location.href
        //https://voice.google.com/?phoneNo=123456789&sms=Hello
        if (checkUrl.startsWith('https://voice.google.com/')) {
            if (checkUrl.includes('phoneNo') && checkUrl.includes('sms')) {
                this.currentNumberSending = checkUrl.substring(checkUrl.indexOf('phoneNo') + 8, checkUrl.indexOf('&'))
                this.messagesToSend = {
                    [this.currentNumberSending]: decodeURIComponent(
                        checkUrl.substring(checkUrl.indexOf('sms') + 4, checkUrl.length)
                    )
                }
                console.log(this.messagesToSend)

                this.sendFromQueueBYOP()
            }
        }
        chrome.runtime.onMessage.addListener((message, sender, response) => {
            if (message.from === 'popup' && message.type === 'SEND_MESSAGES') {
                this.addMessagesToQueue(message.messages)
                this.sendInterval = message.sendInterval

                // switch To Text View
                document.querySelector(selectors.gvMessagesTab).click()

                this.sendFromQueue()
            }

            if (message.from === 'popup' && message.type === 'CHECK_GOOGLE_VOICE_SUPPORT') {
                var url = window.location.href
                response(url.startsWith('https://voice.google.com/') ? 'GV' : false)
            }
        })
    }

    addMessagesToQueue(messages) {
        Object.assign(this.messagesToSend, messages.messages)
        this.numberQueue = this.numberQueue.concat(messages.queue)
    }

    async sendFromQueue() {
        let retryCount = 2
        let verifyOnly = false

        if (this.numberQueue.length > 0) {
            this.currentNumberSending = this.numberQueue.shift()

            let sendExecutionQueue = this.getSendExecutionQueue()
            while (sendExecutionQueue.length) {
                let currentStep = sendExecutionQueue.shift().bind(this)
                const result = await keepTryingAsPromised(currentStep, retryCount > 0)
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

    sendFromQueueBYOP(queueNum = 0) {
        let sendExecutionQueue = this.getSendExecutionQueue()
        // Queue is finished
        if (queueNum === sendExecutionQueue.length) return

        let currentStep = sendExecutionQueue[queueNum].bind(this)
        const currentStepName = getFunctionName(currentStep)
        if (currentStepName === 'confirmSent')
            this.errorActions[currentStepName] = () =>
                showFatalError(
                    `If the problem persists, please wait 24 hours and try again.\n\nError: "${getFunctionName(
                        method
                    )}" failed.`,
                    true
                )
        // If the current step is before the final step (switching back to OpenVPB tab)
        else if (queueNum < sendExecutionQueue.length - 1)
            this.errorActions[currentStepName] = showFatalError(
                `If the problem persists, please report the error in the BYOP Slack channel or via the help link in the extension popup.\n\nError: "${getFunctionName(
                    method
                )}" failed.`,
                true
            )
        tryStep(currentStep, () => this.sendFromQueueBYOP(queueNum + 1), this.errorActions)
    }

    getSendExecutionQueue() {
        return [
            this.showNumberInput,
            this.fillNumberInput,
            this.startChat,
            this.writeMessage,
            this.sendMessage,
            this.confirmThreadHeaderUpdated,
            this.confirmSent,
            this.goBackToOpenVPBTab
        ]
    }

    showNumberInput() {
        if (this.verifyChat()) return true
        var showInputButton = document.querySelector(selectors.gvNumInputButton)
        if (showInputButton && showInputButton.offsetParent !== null) {
            showInputButton.click()
            return true
        }
    }

    fillNumberInput() {
        if (this.verifyChat()) return true
        let numInput = document.querySelector(selectors.gvNumInput)
        if (numInput && numInput.offsetParent !== null) {
            return fillElementAndCheckValue(this.currentNumberSending, numInput)
        }
    }

    // clicks the "Send to" button on the number dropdown
    startChat() {
        if (this.verifyChat()) return true
        var startChatButton = document.querySelector(selectors.gvStartChatButton)
        if (startChatButton && startChatButton.offsetParent !== null) {
            startChatButton.click()
            return true
        }
    }

    writeMessage() {
        if (this.verifyChat()) return true
        const number = this.currentNumberSending
        if (!this.messagesToSend[number]) {
            return false
        }

        const message = this.messagesToSend[number]
        var messageEditor = document.querySelector(selectors.gvMessageEditor)
        if (messageEditor && messageEditor.offsetParent !== null) {
            return fillElementAndCheckValue(message, messageEditor)
        }
    }

    sendMessage() {
        if (this.verifyChat()) return true
        // click send button
        let sendButtonOld = document.querySelector(selectors.gvSendButtonOld)
        let sendButtonNew = document.querySelector(selectors.gvSendButtonNew)
        if (
            sendButtonOld &&
            sendButtonOld.offsetParent !== null &&
            sendButtonOld.getAttribute('aria-disabled') === 'false'
        ) {
            sendButtonOld.click()
            return true
        }
        if (sendButtonNew && sendButtonNew.offsetParent !== null && sendButtonNew.disabled === false) {
            sendButtonNew.dispatchEvent(new Event('mousedown'))
            sendButtonNew.dispatchEvent(new Event('mouseup'))
            sendButtonNew.click()
            return true
        }
    }

    confirmThreadHeaderUpdated() {
        if (this.verifyChat()) return true
        let chatLoadedHeader = document.querySelector(selectors.gvChatLoadedHeader)

        // If we move on before this, it can break things
        if (chatLoadedHeader) {
            return true
        }
    }

    confirmSent() {
        if (this.verifyChat()) return true
        let sendingNote = document.querySelector(selectors.gvSendingNote)

        if (!sendingNote) {
            // check if the message we sent is showing up in the chat window
            let mostRecentMessages = document.querySelectorAll(selectors.gvMostRecentMessages)
            let sentMessageIsThreaded = false
            if (mostRecentMessages && mostRecentMessages.length) {
                var i = mostRecentMessages.length - 1
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
                return true
            }
        }
    }

    goBackToOpenVPBTab() {
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
        window.close()
        return true
    }

    verifyChat() {
        // Check if phone number and sent message are correct
        if (
            checkElementValue(this.currentNumberSending, document.querySelector(selectors.gvNumInput)) &&
            this.confirmThreadHeaderUpdated() &&
            this.confirmSent()
        ) {
            console.log('chat verified')
            return true
        }
        return false
    }
}
