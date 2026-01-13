document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const attachBtn = document.querySelector('.attach-btn'); // Select attach button to disable it too
    const chatMessages = document.getElementById('chatMessages');

    // API Configuration
    const API_URL = './api_stream.php';
    let conversationId = null;

    // Helper: Scroll to bottom
    const scrollToBottom = () => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    // Helper: UI State Management
    const setUIState = (isLoading) => {
        if (isLoading) {
            // Disable inputs
            chatInput.disabled = true;
            sendBtn.disabled = true;
            attachBtn.disabled = true;

            // Show loading spinner on send button
            sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        } else {
            // Enable inputs
            chatInput.disabled = false;
            sendBtn.disabled = false;
            attachBtn.disabled = false;

            // Restore send icon
            sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';

            // Focus input
            chatInput.focus();
        }
    };

    // Helper: Create message element
    const appendMessage = (text, type = 'user') => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${type}-message`);

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        // Initial content
        contentDiv.innerHTML = `<p>${formatText(text)}</p>`;

        const timeSpan = document.createElement('span');
        timeSpan.classList.add('message-time');
        const now = new Date();
        timeSpan.innerText = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeSpan);

        chatMessages.appendChild(messageDiv);
        scrollToBottom();

        // Return the content div for streaming updates
        return contentDiv.querySelector('p');
    };

    const formatText = (text) => {
        return text ? text.replace(/\n/g, '<br>') : '';
    };

    // Main logic: Send Message
    const handleSendMessage = async () => {
        const text = chatInput.value.trim();
        if (!text) return;

        // Visual update for User Message
        appendMessage(text, 'user');
        chatInput.value = '';
        chatInput.style.height = 'auto'; // Reset height

        setUIState(true); // Disable UI, show spinner

        // Prepare payload
        const payload = {
            message: text
        };
        if (conversationId) {
            payload.conv_id = conversationId;
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Prepare for streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let botMessageContent = '';

            // Create Bot Message container (empty initially)
            const botMessageParagraph = appendMessage('', 'bot');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });

                // --- Logic to handle potential JSON vs Plain Text stream ---
                // If the stream returns full JSON objects (e.g. {output: "..."}), we need to parse.
                // If it returns raw text tokens, we just append.
                // Given the ambiguous requirement, and "plain text" request, assume raw text stream is preferred for "continuous" feel.
                // However, we must detect if it's the specific JSON format containing conv_id.

                // Simple heuristic: Cumulative buffering?
                // For now, let's treat it as text. If your webhook sends JSON, this will show JSON.
                // IMPROVEMENT: If the FIRST chunk starts with `{`, it might be JSON.
                // But generally, streaming webhooks for chat return text tokens.

                // Let's try to parse conv_id if present in the *entirety* (which contradicts streaming).
                // Issue: If we stream, we display immediately. If it's a JSON string, user sees JSON.
                // If the user wants "streaming", the server usually sends raw text chunks.
                // BUT, we need `conv_id` for the NEXT message.
                // Strategy: Process the stream. Display it. 
                // BEHIND THE SCENES: We might need to listen for a specific event or parse the final result.

                // Hack for n8n standard webhook response: It usually returns a single JSON object at the END if not using Response Node.
                // If using Response Node (Respond to Webhook), it might send text.
                // I will append chunk to a buffer to extract conv_id later if possible, but stream display the chunk.

                botMessageContent += chunk;
                botMessageParagraph.innerHTML = formatText(botMessageContent);
                scrollToBottom();
            }

            // Post-stream processing (Try to find conv_id in the received content if it was a JSON blob)
            // If the output was actually a JSON string like {"output": "hello", "conv_id": "123"}
            // validation:
            try {
                // Only attempt to parse if it looks like JSON
                if (botMessageContent.trim().startsWith('{') && botMessageContent.trim().endsWith('}')) {
                    const data = JSON.parse(botMessageContent);
                    if (data.conv_id) conversationId = data.conv_id;
                    // If it was JSON, maybe we should have displayed just the message?
                    // If the user sees JSON, it's bad.
                    // Refinement: If data.message or data.output exists, replace the content.
                    if (data.output || data.message) {
                        const cleanText = data.output || data.message;
                        botMessageParagraph.innerHTML = formatText(cleanText);
                    }
                }
            } catch (e) {
                // Not JSON, just plain text stream. 
                // Note: If API doesn't return conv_id in a header or separate way, we might lose it in a pure text stream.
                // Assumption: The API might just be echoing text for now or handling session server-side based upon inputs? 
                // Or maybe the user accepts that plain stream = no conv_id client side update?
                // Let's stick to the visible requirement: "Display currently".
            }

        } catch (error) {
            console.error('Error sending message:', error);
            appendMessage('Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.', 'bot');
        } finally {
            setUIState(false); // Re-enable UI, hide spinner, focus input
        }
    };

    // Event Listeners
    sendBtn.addEventListener('click', handleSendMessage);

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Auto-resize textarea
    chatInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value === '') this.style.height = 'auto';
    });
});
