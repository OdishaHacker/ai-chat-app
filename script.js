// CONFIGURATION
const DEFAULT_MODEL = "deepseek/deepseek-r1:free";
const STORAGE_KEY = "hacker_terminal_v1";

// --- SPECIAL ROLES ---
const ROLES = {
    default: "You are a helpful AI assistant. Be concise and precise.",
    
    coder: "You are a Senior Full Stack Software Architect. You prefer TypeScript, Rust, and Python. You write clean, modular, production-grade code. Always briefly explain the logic, then provide the code block. Use comments in code.",
    
    hacker: "You are an Ethical Cybersecurity Expert (OSCP/CEH certified). You specialize in penetration testing, network analysis, and vulnerability assessment. Explain exploits for educational purposes only and always emphasize remediation/patching. Use tools like Metasploit, Nmap, Wireshark context.",
    
    debugger: "You are an Expert System Debugger. Analyze the provided code or error log. Identify the root cause (Race condition, Memory leak, Syntax, Logic). Provide the fixed code and explain exactly 'Why' it broke."
};

let state = {
    apiKey: "",
    model: DEFAULT_MODEL,
    systemPrompt: ROLES.default,
    currentRole: "default",
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
    roleSelector: document.getElementById('role-selector'),
    statusText: document.getElementById('status-text')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) state = { ...state, ...JSON.parse(stored) };
    
    // UI Setup
    document.getElementById('setting-api-key').value = state.apiKey;
    document.getElementById('setting-system-prompt').value = state.systemPrompt;
    if(state.currentRole) el.roleSelector.value = state.currentRole;
    
    updateStatus();
    renderSidebar();
    
    if (state.chats.length === 0) createNewChat(false);
    else if (!state.currentChatId) state.currentChatId = state.chats[0].id;
    
    loadChat(state.currentChatId);
    
    // Boot Sequence Effect
    setTimeout(() => {
        el.loading.style.opacity = '0';
        setTimeout(() => el.loading.remove(), 500);
        el.app.classList.remove('opacity-0');
    }, 800);
});

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function updateStatus() {
    const roleName = el.roleSelector.options[el.roleSelector.selectedIndex].text;
    el.statusText.innerText = `ACTIVE: ${roleName.toUpperCase()}`;
    el.statusText.style.color = state.currentRole === 'default' ? '#666' : '#00ff41';
}

// --- ROLE SWITCHER ---
function changeRole() {
    const selected = el.roleSelector.value;
    state.currentRole = selected;
    state.systemPrompt = ROLES[selected];
    
    // Update Settings input too
    document.getElementById('setting-system-prompt').value = state.systemPrompt;
    
    updateStatus();
    saveState();
    
    // Visual Feedback
    el.messages.innerHTML += `<div class="text-center text-[10px] text-green-800 font-mono my-2">-- SYSTEM SWITCHED TO [${selected.toUpperCase()}] MODE --</div>`;
    el.messages.scrollTop = el.messages.scrollHeight;
}

// --- UI LOGIC ---
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
    alert("System Config Updated.");
}

// --- CHAT MANAGEMENT ---
function createNewChat(shouldRender = true) {
    const newChat = { id: Date.now().toString(), title: "New Session", messages: [] };
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
    
    document.querySelectorAll('.chat-item').forEach(i => {
        i.classList.remove('active');
        if(i.dataset.id === id) i.classList.add('active');
    });
}

function renderSidebar() {
    el.historyList.innerHTML = '';
    state.chats.forEach(chat => {
        const div = document.createElement('div');
        div.className = `chat-item p-3 cursor-pointer text-xs font-mono truncate text-gray-400 ${chat.id === state.currentChatId ? 'active' : ''}`;
        div.dataset.id = chat.id;
        div.textContent = `> ${chat.title}`;
        div.onclick = () => { loadChat(chat.id); if(window.innerWidth < 768) toggleSidebar(); };
        el.historyList.appendChild(div);
    });
}

// --- MESSAGING ---
function appendMessageToUI(role, content, animate = false) {
    el.welcome.classList.add('hidden');
    const isUser = role === 'user';
    
    const div = document.createElement('div');
    div.className = `flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`;
    
    const bubble = document.createElement('div');
    bubble.className = `max-w-[90%] md:max-w-[85%] rounded-lg px-4 py-2 text-sm leading-relaxed overflow-hidden prose prose-invert ${
        isUser ? 'user-msg' : 'ai-msg w-full'
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

function highlightCode(element) {
    element.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });

    element.querySelectorAll('pre').forEach((pre) => {
        if(pre.querySelector('.copy-btn')) return;
        
        const btn = document.createElement('button');
        btn.className = 'copy-btn';
        btn.textContent = 'COPY';
        btn.onclick = () => {
            navigator.clipboard.writeText(pre.innerText).then(() => {
                btn.textContent = 'COPIED';
                btn.style.color = '#00ff41';
                setTimeout(() => { 
                    btn.textContent = 'COPY'; 
                    btn.style.color = '#888';
                }, 2000);
            });
        };
        pre.appendChild(btn);
    });
}

// --- VOICE (WEB SPEECH API) ---
let recognition;
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => { document.getElementById('mic-btn').classList.add('mic-active'); };
    recognition.onend = () => { document.getElementById('mic-btn').classList.remove('mic-active'); };
    recognition.onresult = (e) => {
        const t = e.results[0][0].transcript;
        el.input.value += (el.input.value ? " " : "") + t;
        autoResize(el.input);
    };
} else { document.getElementById('mic-btn').style.display = 'none'; }

function toggleVoice() {
    if(recognition) try { recognition.start(); } catch(e) { recognition.stop(); }
}

// --- EXPORT ---
function exportChat() {
    const chat = state.chats.find(c => c.id === state.currentChatId);
    if (!chat) return;
    const text = chat.messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}\n`).join('\n----------------\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `log_${chat.id}.txt`;
    a.click();
}

// --- API HANDLER ---
async function handleSendMessage(e) {
    if(e) e.preventDefault();
    const text = el.input.value.trim();
    if (!text) return;
    if (!state.apiKey) { openSettings(); return; }

    el.input.value = '';
    el.input.style.height = 'auto';
    
    // Add User Msg
    const currentChat = state.chats.find(c => c.id === state.currentChatId);
    currentChat.messages.push({ role: 'user', content: text });
    
    if(currentChat.messages.length === 1) {
        currentChat.title = text.slice(0, 25);
        renderSidebar();
    }
    
    saveState();
    appendMessageToUI('user', text);

    // AI Request
    const aiBubble = appendMessageToUI('assistant', '', true);
    let aiResponse = "";
    el.statusText.innerText = "PROCESSING STREAM...";
    el.statusText.classList.add('animate-pulse');

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
                            highlightCode(aiBubble); 
                            el.messages.scrollTop = el.messages.scrollHeight;
                        }
                    } catch (e) {}
                }
            }
        }

        aiBubble.classList.remove('typing-cursor');
        currentChat.messages.push({ role: 'assistant', content: aiResponse });
        saveState();

    } catch (error) {
        aiBubble.innerHTML += `<div class="text-red-500 mt-2">[CONNECTION ERROR]: ${error.message}</div>`;
    } finally {
        updateStatus(); // Reset status text
        el.statusText.classList.remove('animate-pulse');
    }
}

function handleEnter(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage(e);
    }
}

function clearAllData() {
    if(confirm("PURGE SYSTEM DATA?")) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
}
