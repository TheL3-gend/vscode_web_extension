import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';

export interface IUIManager {
  showStatusBarMessage(message: string, isLoading?: boolean, durationMs?: number): void;
  clearStatusBarMessage(): void;
  getCurrentStatusBarText(): string | undefined;
  logOutput(message: string): void;
  getUserInput(prompt: string, placeHolder?: string): Promise<string | undefined>;
  showResponseWebview(markdownContent: string, title: string): void;
  insertIntoEditor(text: string): Promise<void>;
  dispose(): void; // For cleaning up resources
}

export class UIManager implements IUIManager {
  private statusBarItem: vscode.StatusBarItem;
  private outputChannel: vscode.OutputChannel;
  private responsePanel: vscode.WebviewPanel | undefined;
  private mdParser: MarkdownIt;
  private statusBarTimeoutId: NodeJS.Timeout | undefined;


  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.outputChannel = vscode.window.createOutputChannel('ChatGPT Web'); // Centralized channel name
    this.mdParser = new MarkdownIt({ html: false, linkify: true, typographer: true }); // Configure Markdown-it
    this.statusBarItem.show(); // Show it once created
  }

  public showStatusBarMessage(message: string, isLoading = false, durationMs?: number): void {
    if (this.statusBarTimeoutId) {
        clearTimeout(this.statusBarTimeoutId);
        this.statusBarTimeoutId = undefined;
    }
    this.statusBarItem.text = isLoading ? `$(sync~spin) ${message}` : message;
    this.statusBarItem.tooltip = message; // Add tooltip for longer messages
    this.statusBarItem.show();

    if (durationMs && durationMs > 0) {
        this.statusBarTimeoutId = setTimeout(() => {
            // Clear only if the message hasn't changed
            if (this.statusBarItem.text === (isLoading ? `$(sync~spin) ${message}` : message)) {
                this.clearStatusBarMessage();
            }
        }, durationMs);
    }
  }
  
  public clearStatusBarMessage(): void {
      if (this.statusBarTimeoutId) {
        clearTimeout(this.statusBarTimeoutId);
        this.statusBarTimeoutId = undefined;
      }
      this.statusBarItem.text = '';
      this.statusBarItem.tooltip = '';
      //this.statusBarItem.hide(); // Optionally hide if completely empty
  }

  public getCurrentStatusBarText(): string | undefined {
    return this.statusBarItem.text;
  }

  public logOutput(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    // No need to explicitly show output channel on every log, user can open it.
    // this.outputChannel.show(true); // Keep if you want it to pop up often
  }

  public getUserInput(prompt: string, placeHolder?: string): Promise<string | undefined> {
    return Promise.resolve(vscode.window.showInputBox({
      prompt,
      placeHolder,
      ignoreFocusOut: true, // Keep input box focused
    }));
  }

  public showResponseWebview(markdownContent: string, title: string): void {
    const htmlBody = this.mdParser.render(markdownContent);

    if (this.responsePanel) {
      this.responsePanel.title = title;
      this.responsePanel.webview.html = this.getWebviewHtml(htmlBody, title);
      this.responsePanel.reveal(vscode.ViewColumn.Beside, true);
    } else {
      this.responsePanel = vscode.window.createWebviewPanel(
        'chatgptWebResponse', // Panel ID
        title, // Panel title
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        {
          enableScripts: false, // Keep scripts disabled for security unless explicitly needed
          retainContextWhenHidden: true, // Keep content when tab is not visible
          localResourceRoots: [] // No local resources needed for this basic HTML
        }
      );
      this.responsePanel.webview.html = this.getWebviewHtml(htmlBody, title);
      this.responsePanel.onDidDispose(() => {
        this.responsePanel = undefined;
      }, null);
    }
  }

  private getWebviewHtml(bodyContent: string, pageTitle: string): string {
    // Use VS Code's theme variables for styling
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
            background-color: var(--vscode-text-block-quote-background, var(--vscode-editor-background)); /* Fallback for code block background */
            border: 1px solid var(--vscode-text-block-quote-border, var(--vscode-editor-widget-border));
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            font-family: var(--vscode-editor-font-family, monospace); /* Monospace for code */
        }
        code {
            font-family: var(--vscode-editor-font-family, monospace); /* Monospace for code */
            background-color: var(--vscode-text-code-block-background, rgba(128, 128, 128, 0.1)); /* Subtle background for inline code */
            padding: 0.2em 0.4em;
            margin: 0 0.1em;
            border-radius: 3px;
            font-size: 0.9em; /* Slightly smaller for inline code */
        }
        pre > code { /* Reset for code inside pre, as pre handles styling */
            padding: 0;
            margin: 0;
            border-radius: 0;
            background-color: transparent;
            font-size: 1em; /* Normal size inside pre */
        }
        a {
            color: var(--vscode-text-link-foreground);
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        p { margin-top: 0; margin-bottom: 1em; }
        h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; font-weight: bold; }
        ul, ol { margin-bottom: 1em; padding-left: 2em; }
        li { margin-bottom: 0.2em; }
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

  public async insertIntoEditor(text: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active text editor to insert into.');
      return;
    }
    await editor.edit(editBuilder => {
      if (editor.selection.isEmpty) {
        editBuilder.insert(editor.selection.active, text);
      } else {
        // Replace selection if not empty
        editBuilder.replace(editor.selection, text);
      }
    });
  }

  public dispose(): void {
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