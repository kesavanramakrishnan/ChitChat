console.log("Chit Chat content script loaded.");

const CONTAINER_ID = 'chit-chat-container';
const TEXTAREA_SELECTOR = "textarea[data-testid='prompt-textarea']";

let
    promptTextarea = null,
    typingListener = null;

// --- Helper ---
function debounce(func, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}

// --- Core UI Logic ---

function showAnalysisBar(prompt) {
    const container = document.getElementById(CONTAINER_ID);
    if (!container || container.classList.contains('analysis-mode')) return;

    container.classList.add('analysis-mode');
    
    // Determine mock strength
    let strength = "Weak";
    if (prompt.length > 50) strength = "Strong";
    else if (prompt.length > 10) strength = "Moderate";
    
    container.innerHTML = `
        <div class="strength-display">
            Strength: <span class="strength-text ${strength.toLowerCase()}">${strength}</span>
        </div>
        <button class="fix-prompt-btn-onpage">Fix Prompt</button>
    `;
}

function showDefaultIcon() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container || !container.classList.contains('analysis-mode')) return;

    container.classList.remove('analysis-mode');
    container.innerHTML = '✨';
}

function handleTyping() {
    chrome.storage.sync.get({ showOnPageUI: true }, (data) => {
        if (!data.showOnPageUI) {
            showDefaultIcon(); // Ensure it's hidden if toggled off while active
            return;
        }

        const prompt = promptTextarea.value;
        if (prompt.trim().length > 0) {
            showAnalysisBar(prompt);
        } else {
            showDefaultIcon();
        }
    });
}

// --- UI Injection & Listeners ---

function injectUI() {
    if (document.getElementById(CONTAINER_ID)) return;

    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.innerHTML = '✨';
    document.body.appendChild(container);

    attachTypingListener();
}

function removeUI() {
    const container = document.getElementById(CONTAINER_ID);
    if (container) container.remove();
    detachTypingListener();
}

function attachTypingListener() {
    promptTextarea = document.querySelector(TEXTAREA_SELECTOR);
    if (promptTextarea && !typingListener) {
        typingListener = debounce(handleTyping, 2000);
        promptTextarea.addEventListener('input', typingListener);
    }
}

function detachTypingListener() {
    if (promptTextarea && typingListener) {
        promptTextarea.removeEventListener('input', typingListener);
        typingListener = null;
    }
}

// --- Initialization ---

// Initial check to see if we should inject the UI
chrome.storage.sync.get({ showOnPageUI: true }, (data) => {
    if (data.showOnPageUI) {
        // Use an observer to wait for the page to be ready
        const observer = new MutationObserver(() => {
            if (document.querySelector(TEXTAREA_SELECTOR)) {
                injectUI();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
});

// Listen for changes in the toggle state
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.showOnPageUI) {
        if (changes.showOnPageUI.newValue) {
            injectUI();
        } else {
            removeUI();
        }
    }
}); 