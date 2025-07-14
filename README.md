# ChitChat - AI Prompt Enhancer

A Chrome extension that enhances prompt writing on ChatGPT using AI analysis. ChitChat provides real-time feedback, suggestions, and one-click improvements to make your prompts more effective.

## Features

- **Real-Time Prompt Analysis**: Automatically rates your prompt strength (0-100) as you type with a 2-second delay
- **Visual Progress Bar**: Color-coded strength indicator (red to green) with smooth gradients
- **Detailed Analysis**: Get specific suggestions and an improved version of your prompt
- **One-Click Apply**: Instantly replace your prompt with the AI-improved version
- **Multiple AI Providers**: Support for local Ollama, Google AI, OpenAI, and Claude
- **Manual & Auto Modes**: Toggle between automatic analysis and manual click-to-analyze
- **Seamless UI**: Floating glassmorphism design that expands from the bottom-right corner

## How it Works

ChitChat injects a floating UI element on `chatgpt.com` that monitors your prompt input. When you stop typing for 2 seconds, it automatically sends your prompt to the configured AI provider for analysis. The extension displays a strength score and provides detailed suggestions for improvement.

### AI Providers Supported

- **Ollama (Local)**: Run AI models locally on your machine (default)
- **Google AI (Gemini)**: Cloud-based AI analysis
- **OpenAI (GPT)**: GPT-4o-mini and other OpenAI models
- **Claude (Anthropic)**: Claude 3 Haiku and other Claude models

## Installation

### Prerequisites

If using **Ollama (recommended)**:
1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Download a model: `ollama pull phi3:mini` (2GB) or `ollama pull llama3.2:3b` (2GB)
3. Start Ollama: `ollama serve`

### Extension Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** and select the ChitChat directory
5. Navigate to `https://chatgpt.com` to see ChitChat in action

## Configuration

Edit `config.js` to configure your preferred AI provider:

```javascript
const CONFIG = {
    API_PROVIDER: 'ollama', // 'ollama', 'google', 'openai', 'claude'
    
    // Ollama Configuration (Local)
    OLLAMA_API_URL: "http://localhost:11434/api/generate",
    OLLAMA_MODEL: "phi3:mini",
    
    // Add your API keys for cloud providers
    GOOGLE_API_KEY: "your-google-api-key",
    OPENAI_API_KEY: "your-openai-api-key",
    CLAUDE_API_KEY: "your-claude-api-key"
};
```

## Usage

1. **Auto-Analysis Mode** (default): Type in ChatGPT and see real-time strength feedback
2. **Manual Mode**: Click the progress bar to trigger analysis on demand
3. **Detailed Analysis**: Click the ✨ button and select "Get Detailed Analysis"
4. **Apply Improvements**: Use "Apply This Prompt" to replace your input with the improved version

## Project Structure

```
ChitChat/
├── manifest.json          # Extension configuration (Manifest V3)
├── config.js              # API keys and provider settings
├── prompts/
│   └── prompts.js         # AI prompt templates
├── js/
│   └── content.js         # Main extension logic
├── css/
│   └── style.css          # UI styling (glassmorphism design)
├── popup.html             # Extension popup interface
├── js/
│   └── popup.js           # Popup functionality
└── images/                # Extension icons
```

## Local AI Setup (Ollama)

### Recommended Models
- **phi3:mini** (2GB): Fast, good quality for prompt analysis
- **llama3.2:3b** (2GB): Balanced performance and quality
- **llama3.2:8b** (5GB): Higher quality, slower processing

### Commands
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Download a model
ollama pull phi3:mini

# Start Ollama service
ollama serve

# Test the API
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model": "phi3:mini", "prompt": "Hello", "stream": false}'
```

## Troubleshooting

- **CORS Errors**: Ensure Ollama is running with CORS enabled: `OLLAMA_ORIGINS="*" ollama serve`
- **No Analysis**: Check that your AI provider is configured and running
- **Slow Responses**: Try a smaller model or adjust the timeout in `config.js`

## Development

To modify prompt templates, edit `prompts/prompts.js`:
```javascript
const PROMPTS = {
    "strengthPrompt": "Rate this prompt 0-100: {{PROMPT}}",
    "suggestionsPrompt": "Suggest improvements for: {{PROMPT}}",
    "fixPrompt": "Rewrite this prompt better: {{PROMPT}}"
};
```

## License

This project is open source and available under the MIT License. 