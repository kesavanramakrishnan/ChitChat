console.log("Chit Chat content script loaded.");

const CONTAINER_ID = 'chit-chat-container';
const GOOGLE_API_KEY = "AIzaSyDPg-FHJt87jH6_RxyFYwPBUvToIQfAUxg";

// --- API Call ---
async function callGoogleAI(prompt) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_API_KEY}`;

    const body = {
        contents: [{ parts: [{ "text": prompt }] }]
    };

    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Google AI API Error: ${response.status} ${await response.text()}`);
    }

    const json = await response.json();
    if (!json.candidates || !json.candidates[0]?.content?.parts[0]?.text) {
        throw new Error("Invalid response from Google AI API");
    }
    return json.candidates[0].content.parts[0].text.trim();
}


// --- UI Injection & Management ---

function injectUI() {
    if (document.getElementById(CONTAINER_ID)) return;

    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    document.body.appendChild(container);

    const panel = document.createElement('div');
    panel.className = 'chit-chat-hover-panel';
    panel.innerHTML = `
        <div class="cc-panel-section" id="cc-results-section">
            <div class="cc-strength-badge">
                <strong>Strength:</strong>
                <span class="cc-strength-indicator"></span>
                <span id="cc-strength-text"></span>
            </div>
            <div class="cc-suggestions">
                <strong>Suggestions:</strong>
                <div id="cc-suggestions-text"></div>
            </div>
             <div class="cc-fixed-prompt">
                <strong>Revised Prompt:</strong>
                <div id="cc-fixed-prompt-text"></div>
            </div>
        </div>
        <div class="cc-panel-section">
            <button id="analyze-onpage-btn">Analyze Prompt</button>
        </div>
    `;
    container.appendChild(panel);
    
    // Set initial state
    resetPanel(panel);

    const triggerButton = document.createElement('div');
    triggerButton.className = 'chit-chat-trigger-btn';
    triggerButton.innerHTML = '✨';
    container.appendChild(triggerButton);
    
    // Event Handlers
    let hideTimeout;

    container.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
        panel.classList.add('visible');
    });

    container.addEventListener('mouseleave', () => {
        hideTimeout = setTimeout(() => {
            panel.classList.remove('visible');
        }, 300); // 300ms delay to allow moving mouse to panel
    });

    panel.querySelector('#analyze-onpage-btn').addEventListener('click', () => {
        handleAnalysis(panel);
    });
}

function removeUI() {
    const container = document.getElementById(CONTAINER_ID);
    if (container) container.remove();
}

// --- Core Logic ---

function resetPanel(panel) {
    panel.querySelector('#cc-results-section').style.display = 'none';
    const analyzeBtn = panel.querySelector('#analyze-onpage-btn');
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze Prompt';
}

async function handleAnalysis(panel) {
    const promptElement = document.getElementById('prompt-textarea');
    if (!promptElement || !promptElement.textContent) {
        alert("Could not find the prompt or it is empty.");
        return;
    }
    const prompt = promptElement.textContent;

    // Set loading state
    const analyzeBtn = panel.querySelector('#analyze-onpage-btn');
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    panel.querySelector('#cc-results-section').style.display = 'block';
    panel.querySelector('#cc-strength-text').textContent = '...';
    panel.querySelector('#cc-suggestions-text').textContent = '...';
    panel.querySelector('#cc-fixed-prompt-text').textContent = '...';

    const ratingPrompt = `Rate the following prompt as Weak, Moderate, or Strong. Only return the rating word.\n\nPrompt: ${prompt}`;
    const suggestionsPrompt = `Give two short suggestions (under 15 words) to improve this prompt.\n\nPrompt: ${prompt}`;
    const fixPrompt = `Rewrite the prompt to be clearer, specific, and effective.\n\nPrompt: ${prompt}`;

    try {
        const [ratingRes, suggestionsRes, fixedPromptRes] = await Promise.all([
            callGoogleAI(ratingPrompt),
            callGoogleAI(suggestionsPrompt),
            callGoogleAI(fixPrompt),
        ]);
        updatePanelUI(panel, ratingRes, suggestionsRes, fixedPromptRes);
    } catch (error) {
        console.error("Chit Chat Error:", error);
        alert("Failed to get analysis. See console for details.");
        resetPanel(panel);
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analyze Again';
    }
}

function updatePanelUI(panel, rating, suggestions, fixedPrompt) {
    const strengthText = panel.querySelector('#cc-strength-text');
    const strengthIndicator = panel.querySelector('.cc-strength-indicator');
    strengthText.textContent = rating;
    strengthIndicator.className = 'cc-strength-indicator';
    strengthIndicator.classList.add(rating.toLowerCase().replace(/[^a-z]/g, ''));

    panel.querySelector('#cc-suggestions-text').innerHTML = suggestions.replace(/\n/g, '<br>');
    panel.querySelector('#cc-fixed-prompt-text').textContent = fixedPrompt;
}


// --- Initialization ---
chrome.storage.sync.get({ showOnPageUI: true }, (data) => {
    if (data.showOnPageUI) injectUI();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.showOnPageUI) {
        changes.showOnPageUI.newValue ? injectUI() : removeUI();
    }
}); 