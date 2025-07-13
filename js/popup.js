document.addEventListener('DOMContentLoaded', () => {
    const GROQ_API_KEY = "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";

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
                callGroq(ratingPrompt),
                callGroq(suggestionsPrompt),
                callGroq(fixPromptText)
            ]);

            updateUI(ratingRes, suggestionsRes, fixedPromptRes);

        } catch (error) {
            console.error("Error during analysis:", error);
            alert("An error occurred. Please check the console for details.");
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

    async function callGroq(prompt) {
        const body = {
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [{ role: "user", content: prompt }],
        };

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API Error: ${response.status} ${errorText}`);
        }

        const json = await response.json();
        if (!json.choices || json.choices.length === 0) {
            throw new Error("Invalid response from Groq API");
        }
        return json.choices[0].message.content.trim();
    }
}); 