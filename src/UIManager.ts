import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';

export interface IUIManager {
  showStatusBarMessage(message: string, isLoading?: boolean): void;
  logOutput(message: string): void;
  getUserInput(prompt: string): Promise<string | undefined>;
  showResponseWebview(markdownContent: string): void;
  insertIntoEditor(text: string): Promise<void>;
}

export class UIManager implements IUIManager {
  private statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  private outputChannel = vscode.window.createOutputChannel('ChatGPT Web');
  private panel?: vscode.WebviewPanel;
  private md = new MarkdownIt();

  constructor() { this.statusBarItem.show(); }

  public showStatusBarMessage(message: string, isLoading = false) {
    this.statusBarItem.text = isLoading ? `$(sync~spin) ${message}` : message;
    this.statusBarItem.show();
  }
  public logOutput(message: string) {
    const t = new Date().toLocaleTimeString();
    this.outputChannel.appendLine(`[${t}] ${message}`);
    this.outputChannel.show(true);
  }
  public getUserInput(prompt: string): Promise<string | undefined> { return Promise.resolve(vscode.window.showInputBox({ prompt, ignoreFocusOut: true })); }
  public showResponseWebview(mdContent: string) {
    const body = this.md.render(mdContent);
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel('chatgptWebResponse','ChatGPT Response',{viewColumn:vscode.ViewColumn.Beside,preserveFocus:true},{enableScripts:false});
      this.panel.onDidDispose(() => this.panel = undefined);
    }
    this.panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>ChatGPT Response</title>
    <style>
        body {
            font-family: var(--vscode-editor-font-family, var(--vscode-font-family), sans-serif);
            font-size: var(--vscode-editor-font-size);
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            padding: 10px;
            line-height: 1.6;
        }
        pre {
            background-color: var(--vscode-text-code-block-background, var(--vscode-editor-background)); /* Fallback to editor background */
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            font-family: var(--vscode-editor-font-family, var(--vscode-font-family), monospace); /* Ensure monospace for code */
        }
        code {
            font-family: var(--vscode-editor-font-family, var(--vscode-font-family), monospace); /* Ensure monospace for code */
            background-color: var(--vscode-text-code-block-background, var(--vscode-editor-background)); /* Consistent background for inline code */
            padding: 0.2em 0.4em;
            border-radius: 3px;
        }
        pre code { /* Reset padding for code inside pre, as pre handles it */
            padding: 0;
        }
        a {
            color: var(--vscode-text-link-foreground);
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
    </style>
</head>
<body>
    <div>${body}</div>
</body>
</html>`;
    this.panel.reveal(vscode.ViewColumn.Beside);
  }
  public async insertIntoEditor(text: string) {
    const ed = vscode.window.activeTextEditor;
    if (!ed) { vscode.window.showErrorMessage('No editor to insert into.'); return; }
    await ed.edit(b => b.insert(ed.selection.active, text));
  }
}
