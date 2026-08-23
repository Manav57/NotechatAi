// Chat client-side functionality
export function initChat() {
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const messagesContainer = document.getElementById('messages-container');
  const welcomeState = document.getElementById('welcome-state');
  const messagesList = document.getElementById('messages-list');
  const suggestionBtns = document.querySelectorAll('.suggestion-btn');
  const newChatBtn = document.getElementById('new-chat-btn');

  // Auto-resize textarea
  chatInput?.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 192) + 'px';
  });

  // Suggestion buttons
  suggestionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const suggestion = btn.dataset.suggestion;
      if (suggestion && chatInput) {
        chatInput.value = suggestion;
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 192) + 'px';
        chatInput.focus();
      }
    });
  });

  // New chat button
  newChatBtn?.addEventListener('click', () => {
    window.location.href = '/app/chat';
  });

  // Form submission
  chatForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = chatInput?.value.trim();
    if (!message) return;

    // Hide welcome, show messages
    welcomeState?.classList.add('hidden');
    messagesList?.classList.remove('hidden');

    // Add user message
    addMessage('user', message);

    // Clear input
    chatInput!.value = '';
    chatInput!.style.height = 'auto';

    // Show typing indicator
    const typingId = addTypingIndicator();

    try {
      // In real implementation, would stream from /api/chat
      // For now, simulate response
      await new Promise(r => setTimeout(r, 1000));
      
      removeTypingIndicator(typingId);
      
      const response = `Based on your documents (Vaswani et al. 2017, Hochreiter & Schmidhuber 1997), here are the key differences between transformers and RNNs:

**1. Parallelization**
Transformers process all tokens simultaneously via self-attention; RNNs process sequentially.

**2. Long-range Dependencies**
Attention captures arbitrary distances directly; RNNs suffer from vanishing gradients.

**3. Training Efficiency**
Transformers scale better on GPUs/TPUs; RNNs are inherently sequential.

[📄 Attention Is All You Need, p. 3] [📄 LSTM Paper, §2.1]`;
      
      addMessage('assistant', response, [
        { id: '1', title: 'Attention Is All You Need', page: 3 },
        { id: '2', title: 'LSTM Paper', section: '2.1' },
      ]);
    } catch (error) {
      removeTypingIndicator(typingId);
      addMessage('assistant', 'Sorry, something went wrong. Please try again.');
    }
  });

  function addMessage(role, content, citations) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role} flex gap-3 animate-slide-up`;
    
    const avatar = role === 'user' 
      ? `<div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary text-sm font-medium">U</div>`
      : `<div class="w-8 h-8 rounded-full bg-violet flex items-center justify-center text-on-primary text-sm font-medium">AI</div>`;
    
    const citationsHtml = citations && citations.length > 0
      ? `<div class="flex flex-wrap gap-2 mt-4">
          ${citations.map(c => `<span class="badge-secondary badge-sm">📄 ${c.title}${c.page ? `, p. ${c.page}` : ''}${c.section ? `, §${c.section}` : ''}</span>`).join('')}
        </div>`
      : '';
    
    messageDiv.innerHTML = `
      ${avatar}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-body-sm ${role === 'user' ? 'text-ink' : 'text-violet'}">${role === 'user' ? 'You' : 'NotesChatAI'}</span>
          <span class="font-caption-mono text-mute">Just now</span>
        </div>
        <div class="font-body-md text-ink/90 whitespace-pre-wrap">${escapeHtml(content)}</div>
        ${citationsHtml}
      </div>
    `;
    
    messagesList?.appendChild(messageDiv);
    messagesContainer?.scrollTop = messagesContainer.scrollHeight;
  }

  function addTypingIndicator() {
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'message assistant flex gap-3 animate-slide-up';
    div.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-violet flex items-center justify-center text-on-primary text-sm font-medium">AI</div>
      <div class="flex-1">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-body-sm text-violet">NotesChatAI</span>
          <span class="font-caption-mono text-mute">Thinking...</span>
        </div>
        <div class="flex gap-1">
          <span class="w-2 h-2 bg-violet/30 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
          <span class="w-2 h-2 bg-violet/30 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
          <span class="w-2 h-2 bg-violet/30 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
        </div>
      </div>
    `;
    messagesList?.appendChild(div);
    messagesContainer?.scrollTop = messagesContainer.scrollHeight;
    return id;
  }

  function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    el?.remove();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
  }
}