"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UIManager = void 0;
const vscode = __importStar(require("vscode"));
const markdown_it_1 = __importDefault(require("markdown-it"));
class UIManager {
    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.outputChannel = vscode.window.createOutputChannel('ChatGPT Web');
        this.mdParser = new markdown_it_1.default({ html: false, linkify: true, typographer: true });
        this.statusBarItem.show();
    }
    showStatusBarMessage(message, isLoading = false, durationMs) {
        if (this.statusBarTimeoutId) {
            clearTimeout(this.statusBarTimeoutId);
            this.statusBarTimeoutId = undefined;
        }
        this.statusBarItem.text = isLoading ? `$(sync~spin) ${message}` : message;
        this.statusBarItem.tooltip = message;
        this.statusBarItem.show();
        if (durationMs && durationMs > 0) {
            this.statusBarTimeoutId = setTimeout(() => {
                if (this.statusBarItem.text ===
                    (isLoading ? `$(sync~spin) ${message}` : message)) {
                    this.clearStatusBarMessage();
                }
            }, durationMs);
        }
    }
    clearStatusBarMessage() {
        if (this.statusBarTimeoutId) {
            clearTimeout(this.statusBarTimeoutId);
            this.statusBarTimeoutId = undefined;
        }
        this.statusBarItem.text = '';
        this.statusBarItem.tooltip = '';
    }
    getCurrentStatusBarText() {
        return this.statusBarItem.text;
    }
    logOutput(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
    getUserInput(prompt, placeHolder) {
        return new Promise((resolve) => {
            vscode.window.showInputBox({
                prompt,
                placeHolder,
                ignoreFocusOut: true,
            }).then(resolve);
        });
    }
    showResponseWebview(markdownContent, title) {
        const htmlBody = this.mdParser.render(markdownContent);
        if (this.responsePanel) {
            this.responsePanel.title = title;
            this.responsePanel.webview.html = this.getWebviewHtml(htmlBody, title);
            this.responsePanel.reveal(vscode.ViewColumn.Beside, true);
        }
        else {
            this.responsePanel = vscode.window.createWebviewPanel('chatgptWebResponse', title, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, {
                enableScripts: false,
                retainContextWhenHidden: true,
                localResourceRoots: [],
            });
            this.responsePanel.webview.html = this.getWebviewHtml(htmlBody, title);
            this.responsePanel.onDidDispose(() => {
                this.responsePanel = undefined;
            });
        }
    }
    getWebviewHtml(bodyContent, pageTitle) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://*.vscode-cdn.net; img-src https: data:; font-src https://*.vscode-cdn.net;">
  <title>${pageTitle}</title>
  <style>
    body {
      font-family: var(--vscode-font-family, Arial, sans-serif);
      font-size: var(--vscode-font-size);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
      padding: 15px;
      line-height: 1.6;
    }
    pre {
      background-color: var(--vscode-text-block-quote-background, var(--vscode-editor-background));
      border: 1px solid var(--vscode-text-block-quote-border, var(--vscode-editor-widget-border));
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: var(--vscode-editor-font-family, monospace);
    }
    code {
      font-family: var(--vscode-editor-font-family, monospace);
      background-color: var(--vscode-text-code-block-background, rgba(128, 128, 128, 0.1));
      padding: 0.2em 0.4em;
      margin: 0 0.1em;
      border-radius: 3px;
      font-size: 0.9em;
    }
    pre > code {
      padding: 0;
      margin: 0;
      border-radius: 0;
      background-color: transparent;
      font-size: 1em;
    }
    a {
      color: var(--vscode-text-link-foreground);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    p {
      margin-top: 0;
      margin-bottom: 1em;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: bold;
    }
    ul, ol {
      margin-bottom: 1em;
      padding-left: 2em;
    }
    li {
      margin-bottom: 0.2em;
    }
    blockquote {
      margin-left: 0;
      padding-left: 1em;
      border-left: 3px solid var(--vscode-text-block-quote-border, #ccc);
      color: var(--vscode-text-block-quote-foreground, var(--vscode-editor-foreground));
      background-color: var(--vscode-text-block-quote-background, transparent);
    }
  </style>
</head>
<body>
  <div>${bodyContent}</div>
</body>
</html>`;
    }
    async insertIntoEditor(text) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active text editor to insert into.');
            return;
        }
        await editor.edit((editBuilder) => {
            if (editor.selection.isEmpty) {
                editBuilder.insert(editor.selection.active, text);
            }
            else {
                editBuilder.replace(editor.selection, text);
            }
        });
    }
    dispose() {
        this.statusBarItem.dispose();
        this.outputChannel.dispose();
        if (this.responsePanel) {
            this.responsePanel.dispose();
        }
        if (this.statusBarTimeoutId) {
            clearTimeout(this.statusBarTimeoutId);
        }
    }
}
exports.UIManager = UIManager;
//# sourceMappingURL=UIManager.js.map