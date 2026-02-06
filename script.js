// CONFIGURATION
const DEFAULT_MODEL = "deepseek/deepseek-r1:free";
const STORAGE_KEY = "ai_app_pro_v1";

let state = {
    apiKey: "",
    model: DEFAULT_MODEL,
    systemPrompt: "You are a helpful, expert developer assistant.",
    darkMode: true,
    chats: [], 
    currentChatId: null
};

// DOM Elements
const el = {
    app: document.getElementById('app'),
    loading: document.getElementById('loading'),
    messages: document.getElementById('messages-container'),
    input: document.getElementById('user-input'),
    sidebar: document.getElementById('sidebar'),
    historyList: document.getElementById('chat-history-list'),
    welcome: document.getElementById('welcome-message'),
    settingsModal: document.getElementById('settings-modal'),
    micBtn: document.getElementById('mic-btn'),
    statusText: document.getElementById('status-text')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) state = { ...state, ...JSON.parse(stored) };
    
    applyTheme(state.darkMode);
    document.getElementById('setting-api-key').value = state.apiKey;
    document.getElementById('setting-system-prompt').value = state.systemPrompt;
    
    renderSidebar();
    
    if (state.chats.length === 0) createNewChat(false);
    else if (!state.currentChatId) state.currentChatId = state.chats[0].id;
    
    loadChat(state.currentChatId);
    
    // Hide Loader
    setTimeout(() => {
        el.loading.style.opacity = '0';
        setTimeout(() => el.loading.remove(), 500);
        el.app.classList.remove('opacity-0');
    }, 500);
});

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// --- THEME & UI ---
function toggleTheme() {
    state.darkMode = !state.darkMode;
    applyTheme(state.darkMode);
    saveState();
}

function applyTheme(isDark) {
    document.documentElement.classList.toggle('dark', isDark);
    const knob = document.getElementById('theme-knob');
    if(knob) {
        knob.classList.toggle('translate-x-6', isDark);
        knob.classList.toggle('translate-x-1', !isDark);
    }
}

function toggleSidebar() {
    el.sidebar.classList.toggle('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.toggle('hidden');
}

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

function openSettings() { el.settingsModal.classList.remove('hidden'); }
function closeSettings() { el.settingsModal.classList.add('hidden'); }

function saveSettings() {
    state.apiKey = document.getElementById('setting-api-key').value.trim();
    state.systemPrompt = document.getElementById('setting-system-prompt').value.trim();
    saveState();
    closeSettings();
    alert("Saved!");
}

// --- CHAT LOGIC ---
function createNewChat(shouldRender = true) {
    const newChat = { id: Date.now().toString(), title: "New Conversation", messages: [] };
    state.chats.unshift(newChat);
    state.currentChatId = newChat.id;
    saveState();
    renderSidebar();
    if(shouldRender) loadChat(newChat.id);
}

function loadChat(id) {
    state.currentChatId = id;
    const chat = state.chats.find(c => c.id === id);
    el.messages.innerHTML = '';
    
    if (!chat || chat.messages.length === 0) {
        el.messages.appendChild(el.welcome);
        el.welcome.classList.remove('hidden');
    } else {
        el.welcome.classList.add('hidden');
        chat.messages.forEach(msg => appendMessageToUI(msg.role, msg.content, false));
    }
    
    // Sidebar active state
    document.querySelectorAll('.chat-item').forEach(i => {
        i.classList.toggle('bg-gray-200', i.dataset.id === id);
        i.classList.toggle('dark:bg-gray-700', i.dataset.id === id);
    });
}

function renderSidebar() {
    el.historyList.innerHTML = '';
    state.chats.forEach(chat => {
        const div = document.createElement('div');
        div.className = `chat-item p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-sm truncate ${chat.id === state.currentChatId ? 'bg-gray-200 dark:bg-gray-700' : ''}`;
        div.dataset.id = chat.id;
        div.textContent = chat.title;
        div.onclick = () => { loadChat(chat.id); if(window.innerWidth < 768) toggleSidebar(); };
        el.historyList.appendChild(div);
    });
}

// --- MESSAGING & RENDERING ---
function appendMessageToUI(role, content, animate = false) {
    el.welcome.classList.add('hidden');
    const isUser = role === 'user';
    
    const div = document.createElement('div');
    div.className = `flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`;
    
    const bubble = document.createElement('div');
    bubble.className = `max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 text-sm md:text-base leading-relaxed overflow-hidden prose dark:prose-invert ${
        isUser ? 'bg-gray-100 dark:bg-dark-surface rounded-br-none' : 'bg-transparent w-full'
    }`;

    if (isUser) {
        bubble.textContent = content;
    } else {
        if (animate) {
            bubble.classList.add('typing-cursor');
            bubble.innerHTML = ''; 
        } else {
            bubble.innerHTML = marked.parse(content);
            highlightCode(bubble);
        }
    }

    div.appendChild(bubble);
    el.messages.appendChild(div);
    el.messages.scrollTop = el.messages.scrollHeight;
    return bubble;
}

// --- SYNTAX HIGHLIGHTING & COPY ---
function highlightCode(element) {
    // 1. Highlight code blocks
    element.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });

    // 2. Add Copy Buttons
    element.querySelectorAll('pre').forEach((pre) => {
        if(pre.querySelector('.copy-btn')) return; // Avoid duplicates

        const btn = document.createElement('button');
        btn.className = 'copy-btn';
        btn.textContent = 'Copy';
        btn.onclick = () => {
            navigator.clipboard.writeText(pre.innerText).then(() => {
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = 'Copy', 2000);
            });
        };
        pre.appendChild(btn);
    });
}

// --- VOICE INPUT (Web Speech API) ---
let recognition;
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        el.micBtn.classList.add('mic-active');
        el.input.placeholder = "Listening...";
    };

    recognition.onend = () => {
        el.micBtn.classList.remove('mic-active');
        el.input.placeholder = "Message...";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        el.input.value += (el.input.value ? " " : "") + transcript;
        autoResize(el.input);
    };
} else {
    el.micBtn.style.display = 'none'; // Hide if not supported
}

function toggleVoice() {
    if (recognition) {
        try { recognition.start(); } catch(e) { recognition.stop(); }
    } else {
        alert("Voice not supported in this browser.");
    }
}

// --- EXPORT CHAT ---
function exportChat() {
    const chat = state.chats.find(c => c.id === state.currentChatId);
    if (!chat) return;
    
    const text = chat.messages.map(m => `[${m.role.toUpperCase()}]:\n${m.content}\n\n`).join('--- \n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chat-${chat.title.replace(/\s+/g, '_')}.txt`;
    a.click();
}

// --- API HANDLING ---
async function handleSendMessage(e) {
    if(e) e.preventDefault();
    const text = el.input.value.trim();
    if (!text || !state.apiKey) {
        if(!state.apiKey) { alert("API Key Missing!"); openSettings(); }
        return;
    }

    el.input.value = '';
    el.input.style.height = 'auto';
    
    // Add User Message
    const currentChat = state.chats.find(c => c.id === state.currentChatId);
    currentChat.messages.push({ role: 'user', content: text });
    
    // Update Title if new
    if(currentChat.messages.length === 1) {
        currentChat.title = text.slice(0, 30);
        renderSidebar();
    }
    
    saveState();
    appendMessageToUI('user', text);

    // Prepare AI
    const aiBubble = appendMessageToUI('assistant', '', true);
    let aiResponse = "";
    el.statusText.textContent = "AI is thinking...";

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${state.apiKey}`,
                "HTTP-Referer": window.location.href,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: state.model,
                messages: [{ role: "system", content: state.systemPrompt }, ...currentChat.messages],
                stream: true
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const json = JSON.parse(line.substring(6));
                        const content = json.choices[0]?.delta?.content || "";
                        if (content) {
                            aiResponse += content;
                            aiBubble.innerHTML = marked.parse(aiResponse);
                            highlightCode(aiBubble); // Real-time highlight
                            el.messages.scrollTop = el.messages.scrollHeight;
                        }
                    } catch (e) {}
                }
            }
        }

        aiBubble.classList.remove('typing-cursor');
        currentChat.messages.push({ role: 'assistant', content: aiResponse });
        saveState();
        el.statusText.textContent = "AI can make mistakes.";

    } catch (error) {
        aiBubble.innerHTML += `<br><span class="text-red-500">[Error: ${error.message}]</span>`;
    }
}

function handleEnter(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage(e);
    }
}

function clearAllData() {
    if(confirm("Factory Reset?")) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
}
