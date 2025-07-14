// Configuration file for API keys and settings
// This file should be ignored by git to keep API keys secure

const CONFIG = {
    // API Provider Selection: 'google', 'openai', 'ollama', 'claude'
    API_PROVIDER: 'ollama',


    // ------ FOR TESTING USE ------
    // Ollama Configuration (Local)
    OLLAMA_API_URL: "http://localhost:11434/api/generate",
    OLLAMA_MODEL: "phi3:mini", // or "llama3.2:3b", "mistral", phi3:mini.
    

    // ------ FOR LATER USE (prod) ------

    // Google AI Configuration
    GOOGLE_API_KEY: "your-google-api-key-here",
    GOOGLE_MODEL: "gemini-1.5-flash-latest",
    GOOGLE_API_URL: "https://generativelanguage.googleapis.com/v1beta/models/",
    
    // OpenAI Configuration
    OPENAI_API_KEY: "your-openai-api-key-here",
    OPENAI_MODEL: "gpt-4o-mini",
    OPENAI_API_URL: "https://api.openai.com/v1/chat/completions",
    
    // Claude Configuration
    CLAUDE_API_KEY: "your-claude-api-key-here",
    CLAUDE_MODEL: "claude-3-haiku-20240307",
    CLAUDE_API_URL: "https://api.anthropic.com/v1/messages",
    
    // General API Settings
    MAX_OUTPUT_TOKENS: 200,
    TEMPERATURE: 0.3,
    TIMEOUT: 10000 // 10 seconds
};
