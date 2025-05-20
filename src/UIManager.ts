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
  public getUserInput(prompt: string) { return vscode.window.showInputBox({ prompt, ignoreFocusOut: true }); }
  public showResponseWebview(mdContent: string) {
    const body = this.md.render(mdContent);
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel('chatgptWebResponse','ChatGPT Response',{viewColumn:vscode.ViewColumn.Beside,preserveFocus:true},{enableScripts:false});
      this.panel.onDidDispose(() => this.panel = undefined);
    }
    this.panel.webview.html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>ChatGPT Response</title></head><body><div>${body}</div></body></html>`;
    this.panel.reveal(vscode.ViewColumn.Beside);
  }
  public async insertIntoEditor(text: string) {
    const ed = vscode.window.activeTextEditor;
    if (!ed) { vscode.window.showErrorMessage('No editor to insert into.'); return; }
    await ed.edit(b => b.insert(ed.selection.active, text));
  }
}
