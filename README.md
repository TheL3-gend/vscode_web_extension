# ChatGPT Web Assistant for VS Code

A VS Code extension that integrates with ChatGPT's web interface, allowing you to interact with ChatGPT directly from your editor. This extension provides a chat panel similar to GitHub Copilot and enables AI-driven VS Code commands.

## Features

- 🎯 Web-based ChatGPT integration (no API key required)
- 💬 Chat panel with a modern UI
- 📝 Ask questions about your code
- ✏️ Insert AI-generated code directly into your editor
- 🎨 VS Code theme-aware UI
- 🔄 Real-time chat with ChatGPT

## Requirements

- VS Code 1.80.0 or higher
- Chrome/Chromium browser (for web automation)
- Internet connection

## Installation

1. Open VS Code
2. Go to the Extensions view (Ctrl+Shift+X)
3. Search for "ChatGPT Web Assistant"
4. Click Install

## Usage

### Opening the Chat Panel

1. Click the ChatGPT Web icon in the activity bar (left sidebar)
2. Or use the command palette (Ctrl+Shift+P) and type "ChatGPT Web: Open Chat Panel"

### Using the Chat

1. Type your message in the input box at the bottom of the chat panel
2. Press Enter to send your message
3. Wait for ChatGPT's response

### Commands

- `ChatGPT Web: Open Chat Panel` - Opens the chat panel
- `ChatGPT Web: Ask` - Ask a question about selected code
- `ChatGPT Web: Insert` - Insert AI-generated code at the cursor position

### Configuration

The extension can be configured through VS Code settings:

- `chatgpt-web.executablePath`: Path to Chrome/Chromium executable
- `chatgpt-web.headless`: Launch browser in headless mode
- `chatgpt-web.launchArgs`: Additional browser launch arguments

## Known Issues

- The extension requires Chrome/Chromium to be installed on your system
- Initial setup may take a few seconds to launch the browser
- Some websites may block automated access

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
