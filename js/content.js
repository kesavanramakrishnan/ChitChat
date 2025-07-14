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

// --- API Call with caching ---
const promptCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function callGoogleAI(prompt, useCache = true) {
    // Create cache key
    const cacheKey = prompt.trim().toLowerCase();
    
    // Check cache first
    if (useCache && promptCache.has(cacheKey)) {
        const cached = promptCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log("Using cached response for:", prompt.substring(0, 50) + "...");
            return cached.response;
        } else {
            promptCache.delete(cacheKey);
        }
    }
    
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_API_KEY}`;
    const body = { 
        contents: [{ parts: [{ "text": prompt }] }],
        generationConfig: {
            maxOutputTokens: 200, // Limit response length for faster processing
            temperature: 0.3 // Lower temperature for more focused responses
        }
    };
    
    const response = await fetch(API_URL, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(body) 
    });
    
    if (!response.ok) throw new Error(`Google AI API Error: ${response.status} ${await response.text()}`);
    
    const json = await response.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
        console.warn("Invalid response from Google AI API, no text found:", json);
        return "";
    }
    
    const result = text.trim();
    
    // Cache the result
    if (useCache) {
        promptCache.set(cacheKey, {
            response: result,
            timestamp: Date.now()
        });
        
        // Clean old cache entries if cache gets too large
        if (promptCache.size > 50) {
            const oldestKey = promptCache.keys().next().value;
            promptCache.delete(oldestKey);
        }
    }
    
    console.log("Google AI API Response:", result);
    return result;
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
        <div class="chit-chat-expanded-panel">
            <div class="cc-panel-header">
                <h3>Prompt Analysis</h3>
            </div>
            <div id="cc-initial-message" class="cc-initial-message">
                <p>Click "Get Detailed Analysis" to see suggestions and get an improved version of your prompt.</p>
            </div>
            <div id="cc-results-section" style="display: none;">
                 <div class="cc-suggestions"><strong>Suggestions:</strong><div id="cc-suggestions-text"></div></div>
                 <div class="cc-fixed-prompt">
                     <strong>Revised Prompt:</strong>
                     <div id="cc-fixed-prompt-text"></div>
                     <button id="apply-prompt-btn" style="display: none;">Apply This Prompt</button>
                 </div>
            </div>
            <button id="analyze-onpage-btn">Get Detailed Analysis</button>
        </div>
    `;
    document.body.appendChild(container);

    // --- Event Listeners ---
    const mainUI = container.querySelector('.chit-chat-main-ui');
    const expandedPanel = container.querySelector('.chit-chat-expanded-panel');
    
    // Click to expand/collapse
    mainUI.addEventListener('click', () => {
        container.classList.toggle('expanded');
    });
    
    // Click outside expanded panel to close
    document.addEventListener('click', (e) => {
        if (container.classList.contains('expanded') && 
            !expandedPanel.contains(e.target) && 
            !mainUI.contains(e.target)) {
            container.classList.remove('expanded');
        }
    });
    
    // Prevent clicks inside the panel from closing
    expandedPanel.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && container.classList.contains('expanded')) {
            container.classList.remove('expanded');
        }
    });
    
    container.querySelector('#analyze-onpage-btn').addEventListener('click', handleDetailedAnalysis);
    
    // Apply improved prompt button
    container.querySelector('#apply-prompt-btn').addEventListener('click', () => {
        const fixedPromptText = document.getElementById('cc-fixed-prompt-text').textContent;
        applyPromptToInput(fixedPromptText);
        container.classList.remove('expanded');
    });
    
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
        }, 1000); // Reduced from 2000ms to 1000ms for faster response

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

    // Show loading state
    progressBar.classList.add('loading');

    try {
        // Optimized concise prompt for faster response
        const strengthPrompt = `Rate this prompt 0-100 (number only):\n${prompt}`;
        const result = await callGoogleAI(strengthPrompt);
        const score = parseInt(result.replace(/\D/g, ''), 10);
        if (!isNaN(score)) {
            updateProgressBar(score);
        }
    } catch (error) {
        console.error("Chit Chat Auto-Analysis Error:", error);
        updateProgressBar(0); // Reset on error
    } finally {
        // Remove loading state
        progressBar.classList.remove('loading');
    }
}

function updateProgressBar(score) {
    console.log("Updating progress bar to", score);
    const progressBar = document.getElementById('cc-strength-progress-bar');
    if (!progressBar) return;
    
    const clampedScore = Math.max(0, Math.min(100, score));
    progressBar.style.width = `${clampedScore}%`;

    // Create smooth color transition from red to green
    let hue, saturation, lightness;
    
    if (clampedScore <= 50) {
        // Red to orange/yellow (0-50)
        hue = (clampedScore / 50) * 60; // 0 (red) to 60 (yellow)
        saturation = 90;
        lightness = 50;
    } else {
        // Orange/yellow to green (50-100)
        hue = 60 + ((clampedScore - 50) / 50) * 60; // 60 (yellow) to 120 (green)
        saturation = 90;
        lightness = 50;
    }
    
    // Create gradient background
    const color1 = `hsl(${hue}, ${saturation}%, ${lightness - 5}%)`;
    const color2 = `hsl(${hue}, ${saturation - 10}%, ${lightness + 5}%)`;
    const shadowColor = `hsl(${hue}, ${saturation}%, ${lightness - 20}%)`;
    
    // Apply gradient and glow effect
    progressBar.style.background = `linear-gradient(135deg, ${color1}, ${color2})`;
    progressBar.style.boxShadow = `0 0 12px ${shadowColor}40`;
    
    // Remove any CSS class-based styling that might conflict
    progressBar.removeAttribute('data-strength');
}

function applyPromptToInput(text) {
    const promptElement = getPromptElement();
    if (!promptElement) return;

    if (promptElement.tagName.toLowerCase() === 'textarea') {
        // Handle textarea
        promptElement.value = text;
        promptElement.dispatchEvent(new Event('input', { bubbles: true }));
        promptElement.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
        // Handle contenteditable div
        promptElement.textContent = text;
        promptElement.dispatchEvent(new Event('input', { bubbles: true }));
        
        // For contenteditable, we might need to trigger other events
        const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: text
        });
        promptElement.dispatchEvent(inputEvent);
    }
    
    // Focus the element
    promptElement.focus();
}

async function handleDetailedAnalysis() {
    const promptElement = getPromptElement();
    const prompt = getPromptValue(promptElement);
    if (!prompt || prompt.trim().length === 0) { alert("Prompt is empty."); return; }
    
    const analyzeBtn = document.getElementById('analyze-onpage-btn');
    const applyBtn = document.getElementById('apply-prompt-btn');
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    applyBtn.style.display = 'none'; // Hide apply button during analysis
    document.getElementById('cc-results-section').style.display = 'block';
    document.getElementById('cc-initial-message').style.display = 'none'; // Hide initial message

    // Optimized shorter prompts for faster responses
    const suggestionsPrompt = `2 short tips to improve this prompt:\n${prompt}`;
    const fixPrompt = `Rewrite this prompt better:\n${prompt}`;
    
    try {
        const [suggestions, fixedPrompt] = await Promise.all([
            callGoogleAI(suggestionsPrompt), 
            callGoogleAI(fixPrompt)
        ]);
        document.getElementById('cc-suggestions-text').innerHTML = suggestions.replace(/\n/g, '<br>');
        document.getElementById('cc-fixed-prompt-text').textContent = fixedPrompt;
        
        // Show apply button when we have a fixed prompt
        if (fixedPrompt && fixedPrompt.trim().length > 0) {
            applyBtn.style.display = 'block';
        }
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