import * as vscode from 'vscode';
import { ChatPanel } from './ChatPanel';
import { PuppeteerManager } from './PuppeteerManager';
import { VSCodeCommander } from './VSCodeCommander';

let puppeteerManager: PuppeteerManager;
let vsCodeCommander: VSCodeCommander;

export async function activate(context: vscode.ExtensionContext) {
    console.log('ChatGPT Web Extension is now active!');

    // Initialize managers
    puppeteerManager = new PuppeteerManager();
    vsCodeCommander = new VSCodeCommander();

    // Register commands
    let openPanelCommand = vscode.commands.registerCommand('chatgpt-web.openPanel', () => {
        ChatPanel.createOrShow(context.extensionUri);
    });

    let askCommand = vscode.commands.registerCommand('chatgpt-web.ask', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const selection = editor.selection;
        const text = editor.document.getText(selection);

        if (!text) {
            vscode.window.showErrorMessage('No text selected');
            return;
        }

        try {
            const response = await puppeteerManager.sendMessage(text);
            if (ChatPanel.currentPanel) {
                ChatPanel.currentPanel.postMessage({
                    command: 'addMessage',
                    text: response,
                    sender: 'assistant'
                });
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Error: ${error.message}`);
            } else {
                vscode.window.showErrorMessage('An unknown error occurred');
            }
        }
    });

    let insertCommand = vscode.commands.registerCommand('chatgpt-web.insert', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const selection = editor.selection;
        const text = editor.document.getText(selection);

        if (!text) {
            vscode.window.showErrorMessage('No text selected');
            return;
        }

        try {
            const response = await puppeteerManager.sendMessage(text);
            await editor.edit((editBuilder: vscode.TextEditorEdit) => {
                editBuilder.replace(selection, response);
            });
        } catch (error: unknown) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Error: ${error.message}`);
            } else {
                vscode.window.showErrorMessage('An unknown error occurred');
            }
        }
    });

    // Register view provider
    const provider = new ChatViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('chatgpt-web.chatView', provider)
    );

    // Add disposables
    context.subscriptions.push(openPanelCommand, askCommand, insertCommand);
}

interface WebviewMessage {
    type: string;
    value?: string;
    sender?: string;
}

class ChatViewProvider implements vscode.WebviewViewProvider {
    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data: WebviewMessage) => {
            switch (data.type) {
                case 'sendMessage':
                    try {
                        if (data.value) {
                            const response = await puppeteerManager.sendMessage(data.value);
                            webviewView.webview.postMessage({
                                type: 'addMessage',
                                value: response,
                                sender: 'assistant'
                            });
                        }
                    } catch (error: unknown) {
                        if (error instanceof Error) {
                            webviewView.webview.postMessage({
                                type: 'error',
                                value: error.message
                            });
                        } else {
                            webviewView.webview.postMessage({
                                type: 'error',
                                value: 'An unknown error occurred'
                            });
                        }
                    }
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ChatGPT Web</title>
            <style>
                body {
                    padding: 0;
                    margin: 0;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    font-family: var(--vscode-font-family);
                }
                .chat-container {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }
                .messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1rem;
                }
                .input-container {
                    padding: 1rem;
                    border-top: 1px solid var(--vscode-panel-border);
                }
                .input-box {
                    width: 100%;
                    padding: 0.5rem;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 4px;
                }
                .message {
                    margin-bottom: 1rem;
                    padding: 0.5rem;
                    border-radius: 4px;
                }
                .user-message {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                }
                .assistant-message {
                    background-color: var(--vscode-editor-selectionBackground);
                }
            </style>
        </head>
        <body>
            <div class="chat-container">
                <div class="messages" id="messages"></div>
                <div class="input-container">
                    <input type="text" class="input-box" id="messageInput" placeholder="Type your message...">
                </div>
            </div>
            <script>
                (function() {
                    const vscode = acquireVsCodeApi();
                    const messagesContainer = document.getElementById('messages');
                    const messageInput = document.getElementById('messageInput');

                    messageInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter' && messageInput.value.trim()) {
                            const message = messageInput.value.trim();
                            addMessage(message, 'user');
                            vscode.postMessage({
                                type: 'sendMessage',
                                value: message
                            });
                            messageInput.value = '';
                        }
                    });

                    function addMessage(text, sender) {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = \`message \${sender}-message\`;
                        messageDiv.textContent = text;
                        messagesContainer.appendChild(messageDiv);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'addMessage':
                                addMessage(message.value, message.sender);
                                break;
                            case 'error':
                                vscode.window.showErrorMessage(message.value);
                                break;
                        }
                    });
                })();
            </script>
        </body>
        </html>`;
    }
}

export function deactivate() {
    if (puppeteerManager) {
        puppeteerManager.dispose();
    }
}