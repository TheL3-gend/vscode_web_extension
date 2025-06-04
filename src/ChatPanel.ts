import * as vscode from 'vscode';
import * as path from 'path';

interface ChatPanelMessage {
    command: string;
    text: string;
    sender: string;
}

export class ChatPanel {
    public static currentPanel: ChatPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ChatPanel.currentPanel) {
            ChatPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'chatgpt-web.chatView',
            'ChatGPT Web',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media'),
                    vscode.Uri.joinPath(extensionUri, 'out')
                ]
            }
        );

        ChatPanel.currentPanel = new ChatPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.onDidChangeViewState(
            e => {
                if (this._panel.visible) {
                    this._update();
                }
            },
            null,
            this._disposables
        );

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'sendMessage':
                        // Handle sending message to ChatGPT
                        break;
                    case 'executeCommand':
                        // Handle VS Code command execution
                        if (message.commandId) {
                            await vscode.commands.executeCommand(message.commandId);
                        }
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public postMessage(message: ChatPanelMessage): void {
        this._panel.webview.postMessage(message);
    }

    public dispose() {
        ChatPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private async _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
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
                                command: 'sendMessage',
                                text: message
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
                        switch (message.command) {
                            case 'addMessage':
                                addMessage(message.text, message.sender);
                                break;
                        }
                    });
                })();
            </script>
        </body>
        </html>`;
    }
} 