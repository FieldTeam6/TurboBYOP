console.log('options script loaded')
const SUBSTITUTION_REGEX = /([\[\(\{\<]+[\w\s]+[\]\)\}\>])+/g

const messageContainer = document.getElementById('messages')
const messageTemplateHtml = document.getElementById('message-template')
let messageIndex = 0

document.getElementById('settings').addEventListener('change', saveSettings)

browser.storage.local.get(['yourName', 'messageTemplates'])
    .then(({ yourName, messageTemplates }) => {
        if (yourName) {
            document.getElementById('yourName').value = yourName
        }

        if (messageTemplates && messageTemplates.length > 0) {
            messageTemplates.forEach(addMessageTemplate)
        } else {
            addMessageTemplate({
                label: '',
                message: '',
                result: 'Texted'
            })
        }
    })

function addMessageTemplate(template) {
    if (!template) {
        return
    }
    const { label, message, result } = template
    const id = `message-template-${messageIndex++}`

    const messageTemplateNode = messageTemplateHtml.content.firstElementChild.cloneNode(true)
    messageTemplateNode.id = id
    messageTemplateNode.querySelector('.message-template-label').value = label
    messageTemplateNode.querySelector('.message-template-message').value = message
    messageTemplateNode.querySelector('.message-template-result-texted').checked = result === 'Texted'
    messageTemplateNode.querySelector('.close').addEventListener('click', (event) => {
        event.preventDefault()
        document.getElementById(id).remove()
        saveSettings()
        if (messageContainer.childElementCount === 0) {
            addMessageTemplate({
                label: '',
                message: ''
            })
        }
    })
    messageContainer.appendChild(messageTemplateNode)
}

function saveSettings() {
    console.log('saving settings')
    const messageTemplates = []
    const elements = document.getElementsByClassName('message-template')
    let includesTextReplacement = false
    for (let i = 0; i < elements.length; i++) {
        const elem = elements[i]
        const message = elem.querySelector('.message-template-message').value
        if (message) {
            const label = elem.querySelector('.message-template-label')
            if (!label.value) {
                label.value = `Message ${i + 1}`
            }
            messageTemplates.push({
                label: label.value,
                message,
                result: elem.querySelector('.message-template-result-texted').checked ? 'Texted' : null
            })

            includesTextReplacement = includesTextReplacement || SUBSTITUTION_REGEX.test(message)
        }
    }

    if (messageTemplates.length > 0) {
        if (includesTextReplacement) {
            document.getElementById('text-replacement-warning').setAttribute('hidden', 'true')
        } else {
            document.getElementById('text-replacement-warning').removeAttribute('hidden')
        }
    }

    browser.storage.local.set({
        yourName: document.getElementById('yourName').value,
        messageTemplates
    })
}