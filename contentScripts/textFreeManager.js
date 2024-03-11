/**
 * This runs on textfree.us
 */
class TextFreeSiteManager {
    constructor() {
        this.messagesToSend = {}
        this.errorActions = {}
        this.sendInterval = 5000
        this.numberQueue = []
        this.currentNumberSending = ''
    }

    async initialize() {
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

    // Clicks on the New Message button
    startChat() {
        if (this.verifyChat()) return true
        const startChatButton = document.querySelector(selectors.tfStartChatButton)
        if (startChatButton) {
            console.log('starting chat')
            startChatButton.click()
            if (document.querySelector(selectors.tfNumInput)) return true
        }
        return false
    }

    // Enters phone number in the phone number field
    fillNumberInput() {
        if (this.verifyChat()) return true
        console.log('entering phone number')
        return fillElementAndCheckValue(
            this.currentNumberSending,
            document.querySelector(selectors.tfNumInput),
            document.querySelector(selectors.tfNewMessageToInput)
        )
    }

    // Enters message in the message field
    writeMessage() {
        if (this.verifyChat()) return true
        console.log('writing message')
        const message = this.messagesToSend[this.currentNumberSending]
        if (!message) {
            return false
        }

        return fillElementAndCheckValue(message, document.querySelector(selectors.tfMessageEditor))
    }

    // Clicks the send button
    sendMessage() {
        if (this.verifyChat()) return true
        let sendButton = document.querySelector(selectors.tfSendButton)
        if (sendButton && sendButton.disabled === false) {
            console.log('clicking send button')
            sendButton.click()
            return true
        }
        return false
    }

    // Confirms message was sent
    confirmSent() {
        if (this.verifyChat()) return true
        console.log('confirming sent')
        return document.querySelector(selectors.tfMessageBubble) ? true : false
    }

    clickRenameChat() {
        if (this.verifyChatRenamed()) return true
        const optionsMenuDropdownArrow = document.querySelector(selectors.tfOptionsMenuDropdownArrow)
        optionsMenuDropdownArrow?.click()
        const renameButton = document.querySelector(selectors.tfRenameButton)
        if (!renameButton) return false
        renameButton.click()
        console.log('clicking to rename chat')
        return true
    }

    // Renames the conversation from the phone number to the contact's full name
    renameChat() {
        if (this.verifyChatRenamed()) return true
        console.log('renaming chat')
        return fillElementAndCheckValue(
            this.currentContactName,
            document.querySelector(selectors.tfEditNameInput),
            document.querySelector(selectors.tfName)
        )
    }

    goBackToOpenVPBTab() {
        console.log('going back to OpenVPBTab')
        chrome.runtime.sendMessage({ type: 'MESSAGE_SENT' })

        // Switch to OpenVPB tab and save contact
        chrome.runtime.sendMessage({
            type: 'SWITCH_TAB',
            url: 'https://www.openvpb.com/VirtualPhoneBank*'
        })
        chrome.runtime.sendMessage({
            type: 'TALK_TO_TAB',
            url: 'https://www.openvpb.com/VirtualPhoneBank*',
            tabType: 'RECORD_TEXT_IN_DB'
        })
        return true
    }

    verifyChat() {
        // Check if phone number and sent message are correct
        if (
            checkElementValue(this.currentNumberSending, document.querySelector(selectors.tfNewMessageToInput)) &&
            checkElementValue(
                this.messagesToSend[this.currentNumberSending],
                document.querySelector(selectors.tfMessageBubble)
            )
        ) {
            console.log('chat verified')
            return true
        }
        return false
    }

    verifyChatRenamed() {
        return checkElementValue(this.currentContactName, document.querySelector(selectors.tfName))
    }

    getSendExecutionQueue() {
        return [
            this.startChat,
            this.fillNumberInput,
            this.writeMessage,
            this.sendMessage,
            this.confirmSent,
            this.clickRenameChat,
            this.renameChat,
            this.goBackToOpenVPBTab
        ]
    }

    async sendFromQueueBYOP(queueNum = 0) {
        let sendExecutionQueue = this.getSendExecutionQueue()
        // Queue is finished
        if (queueNum === sendExecutionQueue.length) return

        let currentStep = sendExecutionQueue[queueNum].bind(this)
        const currentStepName = getFunctionName(currentStep)

        if (currentStepName === 'fillNumberInput') {
            if (checkElementValue(this.currentContactName, document.querySelector(selectors.tfNewMessageToInput))) {
                showFatalError(
                    `The phone number entered may be a duplicate. Try searching for the contact name using the search button in the BYOP popup window. 
                    If the contact is found and the number for that contact is the same as the current contact's phone number, it is a duplicate. Please report this in the BYOP Slack channel.`,
                    false
                )
            }
            this.errorActions[currentStepName] = () =>
                showFatalError(
                    `Please check your network connection and try reloading the page and clicking the green Set Up Text Message button on the OpenVPB page again. If the problem persists, please report the error in the BYOP Slack channel or via the help link in the extension popup.\n\nError: "${currentStepName}" failed.`,
                    false
                )
            // If the current step is before the final step (switching back to OpenVPB tab)
        } else if (queueNum < sendExecutionQueue.length - 1)
            this.errorActions[currentStepName] = () =>
                showFatalError(
                    `Please check your network connection and try reloading the page and clicking the green Set Up Text Message button on the OpenVPB page again. If the problem persists, please report the error in the BYOP Slack channel or via the help link in the extension popup.\n\nError: "${currentStepName}" failed.`,
                    false
                )
        tryStep(
            currentStep,
            () => this.sendFromQueueBYOP(queueNum + 1),
            this.errorActions,
            currentStepName === 'startChat' || currentStepName === 'confirmSent' ? 10 : 3
        )
    }
}
