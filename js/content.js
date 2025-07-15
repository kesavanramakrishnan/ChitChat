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

// --- Generic API Call with multiple provider support ---
const promptCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function callAI(prompt, useCache = true) {
    // Create cache key
    const cacheKey = `${CONFIG.API_PROVIDER}_${prompt.trim().toLowerCase()}`;
    
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
    
    let result;
    try {
        switch (CONFIG.API_PROVIDER) {
            case 'google':
                result = await callGoogleAI(prompt);
                break;
            case 'openai':
                result = await callOpenAI(prompt);
                break;
            case 'ollama':
                result = await callOllama(prompt);
                break;
            case 'claude':
                result = await callClaude(prompt);
                break;
            default:
                throw new Error(`Unsupported API provider: ${CONFIG.API_PROVIDER}`);
        }
    } catch (error) {
        console.error(`API Error (${CONFIG.API_PROVIDER}):`, error);
        throw error;
    }
    
    // Cache the result
    if (useCache && result) {
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
    
    console.log(`${CONFIG.API_PROVIDER} API Response:`, result);
    return result;
}

// Google AI API Implementation
async function callGoogleAI(prompt) {
    const API_URL = `${CONFIG.GOOGLE_API_URL}${CONFIG.GOOGLE_MODEL}:generateContent?key=${CONFIG.GOOGLE_API_KEY}`;
    const body = { 
        contents: [{ parts: [{ "text": prompt }] }],
        generationConfig: {
            maxOutputTokens: CONFIG.MAX_OUTPUT_TOKENS,
            temperature: CONFIG.TEMPERATURE
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
    
    return text.trim();
}

// OpenAI API Implementation
async function callOpenAI(prompt) {
    const response = await fetch(CONFIG.OPENAI_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${CONFIG.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: CONFIG.OPENAI_MODEL,
            messages: [{ role: "user", content: prompt }],
            max_tokens: CONFIG.MAX_OUTPUT_TOKENS,
            temperature: CONFIG.TEMPERATURE
        })
    });
    
    if (!response.ok) throw new Error(`OpenAI API Error: ${response.status} ${await response.text()}`);
    
    const json = await response.json();
    return json.choices?.[0]?.message?.content?.trim() || "";
}

// Ollama API Implementation (Local)
async function callOllama(prompt) {
    console.log("🔄 Calling Ollama with prompt:", prompt.substring(0, 100) + "...");
    console.log("🔧 Config:", { 
        url: CONFIG.OLLAMA_API_URL, 
        model: CONFIG.OLLAMA_MODEL, 
        timeout: CONFIG.TIMEOUT 
    });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);
    
    try {
        const requestBody = {
            model: CONFIG.OLLAMA_MODEL,
            prompt: prompt,
            stream: false,
            options: {
                temperature: CONFIG.TEMPERATURE,
                num_predict: CONFIG.MAX_OUTPUT_TOKENS
            }
        };
        
        console.log("📤 Request body:", requestBody);
        
        const response = await fetch(CONFIG.OLLAMA_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log("📥 Response status:", response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Ollama API Error:", response.status, errorText);
            throw new Error(`Ollama API Error: ${response.status} ${errorText}`);
        }
        
        const json = await response.json();
        console.log("✅ Ollama response:", json);
        
        const result = json.response?.trim() || "";
        console.log("🎯 Final result length:", result.length);
        return result;
    } catch (error) {
        clearTimeout(timeoutId);
        console.error("💥 Ollama error:", error);
        if (error.name === 'AbortError') {
            throw new Error('Ollama request timed out - is Ollama running?');
        }
        throw error;
    }
}

// Claude API Implementation
async function callClaude(prompt) {
    const response = await fetch(CONFIG.CLAUDE_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": CONFIG.CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
            model: CONFIG.CLAUDE_MODEL,
            max_tokens: CONFIG.MAX_OUTPUT_TOKENS,
            temperature: CONFIG.TEMPERATURE,
            messages: [{ role: "user", content: prompt }]
        })
    });
    
    if (!response.ok) throw new Error(`Claude API Error: ${response.status} ${await response.text()}`);
    
    const json = await response.json();
    return json.content?.[0]?.text?.trim() || "";
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
    
    // Manual analysis when clicking the progress bar (for testing)
    container.querySelector('.cc-strength-progress-bar-container').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent expanding the popup
        const promptElement = getPromptElement();
        const prompt = getPromptValue(promptElement);
        if (prompt && prompt.trim().length >= 5) {
            console.log("🖱️ Manual analysis triggered by progress bar click");
            handleAutoAnalysis(prompt);
        } else {
            console.log("⚠️ Prompt too short for analysis");
        }
    });
    
    // --- TOGGLE BETWEEN AUTO-ANALYSIS AND MANUAL MODE ---
    // Comment out the line below to disable auto-analysis and use manual mode only
    startListeningToPrompt();
    
    // Uncomment the line below to enable manual mode only (no auto-analysis)
    // startManualPromptListening();
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

// Auto-analysis function - triggers when user stops typing for 2 seconds
function startListeningToPrompt() {
    stopListeningToPrompt(); // Ensure no duplicates
    const promptElement = getPromptElement();
    lastPromptElement = promptElement; // Store reference

    if (promptElement) {
        const debouncedAnalysis = debounce(() => {
            const currentPrompt = getPromptValue(promptElement);
            handleAutoAnalysis(currentPrompt);
        }, 1000); // 2 second delay after user stops typing

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


// Manual prompt listening - monitors but doesn't auto-analyze (click progress bar to analyze)
function startManualPromptListening() {
    stopListeningToPrompt(); // Ensure no duplicates
    const promptElement = getPromptElement();
    lastPromptElement = promptElement; // Store reference

    if (promptElement) {
        console.log("📝 Manual mode: Prompt listening started - click progress bar to analyze");
        
        // Just monitor for prompt element changes without auto-analysis
        const elementChecker = debounce(() => {
            console.log("📝 Prompt element detected and monitored (manual mode)");
        }, 1000);

        // Monitor the element but don't analyze automatically
        if (promptElement.tagName.toLowerCase() === 'textarea') {
            promptInputListener = elementChecker;
            promptElement.addEventListener('input', promptInputListener);
        } else {
            promptObserver = new MutationObserver(elementChecker);
            promptObserver.observe(promptElement, {
                characterData: true,
                childList: true,
                subtree: true
            });
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
    console.log("🔄 Auto-analysis triggered with prompt:", prompt.substring(0, 100) + "...");
    const progressBar = document.getElementById('cc-strength-progress-bar');
    if (!progressBar) return;

    if (prompt.trim().length < 5) {
        updateProgressBar(0); // Reset if prompt is too short
        return;
    }

    // Show loading state
    progressBar.classList.add('loading');

    try {
        // Use prompt template from prompts.json
        const strengthPrompt = PROMPTS.strengthPrompt.replace('{{PROMPT}}', prompt);
        console.log("📊 Using strength prompt template");
        const result = await callAI(strengthPrompt);
        // Extract only the first number encountered in the response
        const match = result.match(/\d+/);
        const score = match ? parseInt(match[0], 10) : NaN;
        if (!isNaN(score)) {
            updateProgressBar(score);
            console.log("✅ Auto-analysis completed, score:", score);
        } else {
            console.warn("⚠️ Invalid score returned:", result);
            updateProgressBar(0);
        }
    } catch (error) {
        console.error("💥 Chit Chat Auto-Analysis Error:", error);
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
    console.log("🚀 Starting detailed analysis...");
    
    const promptElement = getPromptElement();
    const prompt = getPromptValue(promptElement);
    console.log("📝 Input prompt:", prompt?.substring(0, 100) + "...");
    
    if (!prompt || prompt.trim().length === 0) { 
        console.warn("⚠️ Prompt is empty");
        alert("Prompt is empty."); 
        return; 
    }
    
    const analyzeBtn = document.getElementById('analyze-onpage-btn');
    const applyBtn = document.getElementById('apply-prompt-btn');
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    applyBtn.style.display = 'none'; // Hide apply button during analysis
    document.getElementById('cc-results-section').style.display = 'block';
    document.getElementById('cc-initial-message').style.display = 'none'; // Hide initial message

    // Use prompt templates from prompts.json
    const suggestionsPrompt = PROMPTS.suggestionsPrompt.replace('{{PROMPT}}', prompt);
    const fixPrompt = PROMPTS.fixPrompt.replace('{{PROMPT}}', prompt);
    
    console.log("🔀 Making parallel API calls...");
    console.log("  📋 Suggestions prompt:", suggestionsPrompt.substring(0, 100) + "...");
    console.log("  🔧 Fix prompt:", fixPrompt.substring(0, 100) + "...");
    
    try {
        const [suggestions, fixedPrompt] = await Promise.all([
            callAI(suggestionsPrompt), 
            callAI(fixPrompt)
        ]);
        
        console.log("✅ Got suggestions:", suggestions?.substring(0, 100) + "...");
        console.log("✅ Got fixed prompt:", fixedPrompt?.substring(0, 100) + "...");
        
        document.getElementById('cc-suggestions-text').innerHTML = suggestions.replace(/\n/g, '<br>');
        document.getElementById('cc-fixed-prompt-text').textContent = fixedPrompt;
        
        // Show apply button when we have a fixed prompt
        if (fixedPrompt && fixedPrompt.trim().length > 0) {
            applyBtn.style.display = 'block';
            console.log("✨ Apply button shown");
        } else {
            console.warn("⚠️ No fixed prompt to show");
        }
        
        console.log("🎉 Analysis completed successfully!");
    } catch (error) {
        console.error("💥 Chit Chat Detailed Analysis Error:", error);
        console.error("💥 Error details:", {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        alert(`Failed to get detailed analysis: ${error.message}`);
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Get Detailed Analysis';
        console.log("🏁 Analysis function completed");
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