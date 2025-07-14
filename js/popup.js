document.addEventListener('DOMContentLoaded', () => {
    const promptInput = document.getElementById('prompt-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    const resultsSection = document.getElementById('results-section');
    const strengthText = document.getElementById('strength-text');
    const strengthIndicator = document.querySelector('.strength-indicator');
    const suggestionsText = document.getElementById('suggestions-text');
    const fixedPromptText = document.getElementById('fixed-prompt-text');
    const onPageUiToggle = document.getElementById('toggle-on-page-ui');

    // Load saved state for the toggle
    chrome.storage.sync.get({ showOnPageUI: true }, (data) => {
        onPageUiToggle.checked = data.showOnPageUI;
    });

    analyzeBtn.addEventListener('click', handleAnalysis);
    onPageUiToggle.addEventListener('change', handleToggleChange);

    function handleToggleChange(event) {
        chrome.storage.sync.set({ showOnPageUI: event.target.checked });
    }

    async function handleAnalysis() {
        const prompt = promptInput.value;
        if (prompt.trim().length < 5) {
            alert("Please enter a prompt longer than 5 characters.");
            return;
        }

        setLoadingState(true);

        const ratingPrompt = `Rate the following prompt as Weak, Moderate, or Strong. Consider clarity, specificity, and completeness. Only return the rating word.\n\nPrompt: ${prompt}`;
        const suggestionsPrompt = `Give two short suggestions (each under 15 words) to improve this prompt.\n\nPrompt: ${prompt}`;
        const fixPromptText = `Rewrite the following prompt to be clearer, more specific, and more effective, while preserving its intent.\n\nPrompt: ${prompt}`;

        try {
            const [ratingRes, suggestionsRes, fixedPromptRes] = await Promise.all([
                callAI(ratingPrompt),
                callAI(suggestionsPrompt),
                callAI(fixPromptText)
            ]);

            updateUI(ratingRes, suggestionsRes, fixedPromptRes);

        } catch (error) {
            console.error("Error during analysis:", error);
            alert(`An error occurred with ${CONFIG.API_PROVIDER}: ${error.message}`);
        } finally {
            setLoadingState(false);
        }
    }

    function updateUI(rating, suggestions, fixedPrompt) {
        // Update Strength
        const ratingClean = rating.toLowerCase().replace(/[^a-z]/g, '');
        strengthText.textContent = rating;
        strengthIndicator.className = 'strength-indicator'; // Reset
        strengthIndicator.classList.add(ratingClean);

        // Update Suggestions
        suggestionsText.innerHTML = suggestions.replace(/\n/g, '<br>');

        // Update Fixed Prompt
        fixedPromptText.textContent = fixedPrompt;
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = 'Analyzing...';
            resultsSection.classList.remove('hidden');
            
            strengthText.textContent = '...';
            strengthIndicator.className = 'strength-indicator loading';
            suggestionsText.textContent = '...';
            fixedPromptText.textContent = '...';
            
        } else {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Analyze Prompt';
        }
    }

    // Use the same generic API function from content.js
    // This will be available because config.js is loaded first
    async function callAI(prompt) {
        const promptCache = new Map();
        const cacheKey = `${CONFIG.API_PROVIDER}_${prompt.trim().toLowerCase()}`;
        
        // Simple cache check for popup
        if (promptCache.has(cacheKey)) {
            const cached = promptCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 300000) { // 5 minutes
                return cached.response;
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
            
            // Cache the result
            promptCache.set(cacheKey, { response: result, timestamp: Date.now() });
            return result;
            
        } catch (error) {
            console.error(`Popup API Error (${CONFIG.API_PROVIDER}):`, error);
            throw error;
        }
    }

    // API implementations (copied from content.js for popup context)
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

    async function callOllama(prompt) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);
        
        try {
            const response = await fetch(CONFIG.OLLAMA_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: CONFIG.OLLAMA_MODEL,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: CONFIG.TEMPERATURE,
                        num_predict: CONFIG.MAX_OUTPUT_TOKENS
                    }
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ollama API Error: ${response.status} ${errorText}`);
            }
            
            const json = await response.json();
            return json.response?.trim() || "";
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Ollama request timed out - is Ollama running?');
            }
            throw error;
        }
    }

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
}); 