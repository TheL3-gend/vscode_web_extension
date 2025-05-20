import * as vscode from 'vscode';
import { PuppeteerManager } from './PuppeteerManager';
import { ResponseParser } from './ResponseParser';
import { VSCodeCommander } from './VSCodeCommander';
import { UIManager } from './UIManager';

let puppeteerManager: any;

export function activate(context: vscode.ExtensionContext) {
  puppeteerManager = new PuppeteerManager();
  const parser = new ResponseParser();
  const commander = new VSCodeCommander();
  const ui = new UIManager();

  context.subscriptions.push(
    vscode.commands.registerCommand('chatgpt-web.ask', async () => {
      const prompt = await ui.getUserInput('Enter prompt');
      if (!prompt) return;
      ui.showStatusBarMessage('Sending…', true);
      // ...
      ui.showStatusBarMessage('', false);
    }),
    vscode.commands.registerCommand('chatgpt-web.insert', async () => {
      const prompt = await ui.getUserInput('Enter prompt to insert');
      if (!prompt) return;
      ui.showStatusBarMessage('Sending…', true);
      // ...
      ui.showStatusBarMessage('', false);
    })
  );
}

export function deactivate() {
  if (puppeteerManager && puppeteerManager.isInitialized()) {
    puppeteerManager.closeBrowser();
  }
}
