# Groq Prompt Enhancer

This Chrome extension enhances the prompt-writing experience on `chat.openai.com` by providing real-time feedback and one-click improvements using Groq's LLaMA 4 Scout model.

## Features

- **Live Prompt Strength**: Rates your prompt as you type (Weak, Moderate, or Strong).
- **Instant Suggestions**: Provides concrete suggestions to improve your prompt's clarity and effectiveness.
- **One-Click Fix**: Automatically rewrites your prompt for better structure and specificity with a single click.
- **Seamless UI**: Injects a clean, non-intrusive UI directly above and below the ChatGPT input box.

## How it Works

The extension uses a content script to detect the prompt input field on `chat.openai.com`. As you type, it sends debounced requests to the Groq API with specific instructions to analyze, rate, and suggest improvements for your prompt. The "Fix Prompt" button sends a request to rewrite the prompt entirely.

All API interactions happen directly from your browser to the Groq API.

## Installation

1.  Clone this repository or download the source code as a ZIP file and extract it.
2.  Open Google Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer mode** using the toggle in the top-right corner.
4.  Click the **Load unpacked** button.
5.  Select the `ChitChat` directory (or the directory where you extracted the files).
6.  The extension is now installed. Navigate to `https://chat.openai.com` to see it in action.

## Project Structure

-   `manifest.json`: Defines the extension's permissions and configuration (Manifest V3).
-   `js/content.js`: Contains all the logic for DOM manipulation, UI injection, and Groq API calls.
-   `css/style.css`: Provides the styling for all injected UI elements.
-   `images/`: Contains the extension icons. 