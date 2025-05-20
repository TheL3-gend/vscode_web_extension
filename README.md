# VS Code ChatGPT Web Extension

**Experimental** extension to drive the ChatGPT web interface directly from VS Code without an API key.

## Features

- Send prompts to ChatGPT from VS Code (`chatgpt-web.ask`).
- Insert AI responses or code blocks directly into the editor (`chatgpt-web.insert`).
- Execute AI‑driven commands:
  - `readFile`
  - `writeFile` (with user confirmation)
  - `executeTerminal` (with user confirmation)
  - `getWorkspaceFiles`
  - `getDiagnostics`
  - `getActiveFileInfo`
  - `getSelection`
- Logs human-readable system messages in the **ChatGPT Web** output channel.
- Renders final AI responses in a Markdown‑powered Webview.

## Installation

1. Clone or download this repo.
2. Run `npm install`.
3. Compile: `npm run compile`.
4. In VS Code, press **F5** to open the Extension Development Host.
5. Use the commands from the **Command Palette**:
   - **ChatGPT Web: Ask** 
   - **ChatGPT Web: Insert**

## Configuration

Available in **Settings** (`chatgpt-web`):

- `browserExecutablePath` (string): Path to Chrome/Chromium.
- `headless` (boolean): Launch browser headless or headful.

## Caveat

This extension automates the ChatGPT web UI. If OpenAI changes their interface or selectors, it may break. Use as an experimental tool.

## License

MIT
