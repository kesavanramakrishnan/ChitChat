console.log("Chit Chat content script loaded.");

const CONTAINER_ID = 'chit-chat-container';
const GOOGLE_API_KEY = CONFIG.GOOGLE_API_KEY;
// A more robust set of selectors for different ChatGPT UIs
const PROMPT_SELECTORS = [
    "textarea[data-testid='prompt-textarea']", // Standard
    "#prompt-textarea", // Common ID
    "div[data-lexical-editor='true']" // Rich text editor
];

// --- Helpers ---
function getPromptElement() {
    for (const selector of PROMPT_SELECTORS) {
        const element = document.querySelector(selector);
        if (element) return element;
    }
    return null;
}

function getPromptValue(element) {
    if (!element) return null;
    // Use .value for <textarea>, and .textContent for <div> editors
    return element.tagName.toLowerCase() === 'textarea' ? element.value : element.textContent;
}

function debounce(func, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}

// --- API Call ---
async function callGoogleAI(prompt) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_API_KEY}`;
    const body = { contents: [{ parts: [{ "text": prompt }] }] };
    const response = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`Google AI API Error: ${response.status} ${await response.text()}`);
    const json = await response.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
        console.warn("Invalid response from Google AI API, no text found:", json);
        return "";
    }
    console.log("Google AI API Response:", text);
    return text.trim();
}

// --- UI Management ---

function injectUI() {
    if (document.getElementById(CONTAINER_ID)) return;
    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.innerHTML = `
        <div class="chit-chat-main-ui">
            <div class="chit-chat-trigger-btn">✨</div>
            <div class="cc-strength-progress-bar-container">
                <div id="cc-strength-progress-bar" class="cc-strength-progress-bar"></div>
            </div>
        </div>
        <div class="chit-chat-hover-panel">
            <div id="cc-results-section" style="display: none;">
                 <div class="cc-suggestions"><strong>Suggestions:</strong><div id="cc-suggestions-text"></div></div>
                 <div class="cc-fixed-prompt"><strong>Revised Prompt:</strong><div id="cc-fixed-prompt-text"></div></div>
            </div>
            <button id="analyze-onpage-btn">Get Detailed Analysis</button>
        </div>
    `;
    document.body.appendChild(container);

    // --- Event Listeners ---
    let hideTimeout;
    container.addEventListener('mouseenter', () => { clearTimeout(hideTimeout); container.querySelector('.chit-chat-hover-panel').classList.add('visible'); });
    container.addEventListener('mouseleave', () => { hideTimeout = setTimeout(() => container.querySelector('.chit-chat-hover-panel').classList.remove('visible'), 300); });
    container.querySelector('#analyze-onpage-btn').addEventListener('click', handleDetailedAnalysis);
    
    startListeningToPrompt();
}

function removeUI() {
    const container = document.getElementById(CONTAINER_ID);
    if (container) container.remove();
    stopListeningToPrompt();
}

// --- Core Logic & Listeners ---

let promptObserver = null;
let promptInputListener = null;
let lastPromptElement = null; // Keep a reference to the element we're listening to

function startListeningToPrompt() {
    stopListeningToPrompt(); // Ensure no duplicates
    const promptElement = getPromptElement();
    lastPromptElement = promptElement; // Store reference

    if (promptElement) {
        const debouncedAnalysis = debounce(() => {
            const currentPrompt = getPromptValue(promptElement);
            handleAutoAnalysis(currentPrompt);
        }, 2000);

        // Check if it's a textarea or a div and attach the correct listener
        if (promptElement.tagName.toLowerCase() === 'textarea') {
            promptInputListener = debouncedAnalysis;
            promptElement.addEventListener('input', promptInputListener);
        } else {
            promptObserver = new MutationObserver(debouncedAnalysis);
            promptObserver.observe(promptElement, {
                characterData: true,
                childList: true,
                subtree: true
            });
        }

        // Trigger analysis for any pre-existing text.
        const promptText = getPromptValue(promptElement);
        if (promptText && promptText.trim().length > 0) {
            debouncedAnalysis();
        }
    }
}

function stopListeningToPrompt() {
    if (promptObserver) {
        promptObserver.disconnect();
        promptObserver = null;
    }
    if (lastPromptElement && promptInputListener) {
        lastPromptElement.removeEventListener('input', promptInputListener);
        promptInputListener = null;
    }
    lastPromptElement = null;
}

async function handleAutoAnalysis(prompt) {
    console.log("handleAutoAnalysis called with prompt:", prompt);
    const progressBar = document.getElementById('cc-strength-progress-bar');
    if (!progressBar) return;

    if (prompt.trim().length < 5) {
        updateProgressBar(0); // Reset if prompt is too short
        return;
    }

    try {
        const strengthPrompt = `Rate the strength of the following prompt on a scale from 0 to 100, where 0 is very weak and 100 is very strong. Return ONLY the number.\n\nPrompt: ${prompt}`;
        const result = await callGoogleAI(strengthPrompt);
        const score = parseInt(result.replace(/\D/g, ''), 10);
        if (!isNaN(score)) {
            updateProgressBar(score);
        }
    } catch (error) {
        console.error("Chit Chat Auto-Analysis Error:", error);
        updateProgressBar(0); // Reset on error
    }
}

function updateProgressBar(score) {
    console.log("Updating progress bar to", score);
    const progressBar = document.getElementById('cc-strength-progress-bar');
    if (!progressBar) return;
    
    const clampedScore = Math.max(0, Math.min(100, score));
    progressBar.style.width = `${clampedScore}%`;

    // Interpolate color from red (0) to green (120) in HSL color space
    const hue = (clampedScore / 100) * 120;
    progressBar.style.backgroundColor = `hsl(${hue}, 90%, 45%)`;
}

async function handleDetailedAnalysis() {
    const promptElement = getPromptElement();
    const prompt = getPromptValue(promptElement);
    if (!prompt || prompt.trim().length === 0) { alert("Prompt is empty."); return; }
    
    const analyzeBtn = document.getElementById('analyze-onpage-btn');
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    document.getElementById('cc-results-section').style.display = 'block';

    const suggestionsPrompt = `Give two short suggestions (under 15 words) to improve this prompt.\n\nPrompt: ${prompt}`;
    const fixPrompt = `Rewrite the prompt to be clearer, specific, and effective.\n\nPrompt: ${prompt}`;
    
    try {
        const [suggestions, fixedPrompt] = await Promise.all([callGoogleAI(suggestionsPrompt), callGoogleAI(fixPrompt)]);
        document.getElementById('cc-suggestions-text').innerHTML = suggestions.replace(/\n/g, '<br>');
        document.getElementById('cc-fixed-prompt-text').textContent = fixedPrompt;
    } catch (error) {
        console.error("Chit Chat Detailed Analysis Error:", error);
        alert("Failed to get detailed analysis.");
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Get Detailed Analysis';
    }
}

// --- Initialization ---
let isListening = false;

function initOrUpdate() {
    const promptTextarea = getPromptElement();

    if (promptTextarea && !isListening) {
        console.log("Chit Chat: Textarea found, injecting UI.");
        injectUI();
        isListening = true;
    } else if (!promptTextarea && isListening) {
        console.log("Chit Chat: Textarea not found, removing UI.");
        removeUI();
        isListening = false;
    }
}

const observer = new MutationObserver(initOrUpdate);

function startObserver() {
    observer.observe(document.body, { childList: true, subtree: true });
    initOrUpdate(); // Check immediately on start
}

function stopObserver() {
    observer.disconnect();
    removeUI(); // Also removes UI
    isListening = false;
}

chrome.storage.sync.get({ showOnPageUI: true }, (data) => {
    if (data.showOnPageUI) {
        startObserver();
    }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.showOnPageUI) {
        if (changes.showOnPageUI.newValue) {
            startObserver();
        } else {
            stopObserver();
        }
    }
}); 