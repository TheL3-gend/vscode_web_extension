import * as vscode from 'vscode';
import { PuppeteerManager } from './PuppeteerManager';
import { ResponseParser } from './ResponseParser';
import { VSCodeCommander } from './VSCodeCommander';
import { UIManager } from './UIManager';

let puppeteerManager: PuppeteerManager;

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
      try {
        if (!puppeteerManager.isInitialized()) {
          ui.showStatusBarMessage('Initializing ChatGPT...', true);
          await puppeteerManager.initialize();
        }
        ui.showStatusBarMessage('Sending prompt to ChatGPT...', true);
        const htmlResponse = await puppeteerManager.sendPrompt(prompt);
        const parsedResponse = parser.parse(htmlResponse);
        if (parsedResponse.commands && parsedResponse.commands.length > 0) {
          ui.logOutput(`Executing ${parsedResponse.commands.length} command(s) from ChatGPT...`);
          for (const command of parsedResponse.commands) {
            const result = await commander.execute(command);
            if (result.success) {
              ui.logOutput(`Executed command '${command.action}': ${JSON.stringify(result.output)}`);
            } else {
              ui.logOutput(`Failed to execute command '${command.action}': ${result.error}`);
              vscode.window.showWarningMessage(`Failed to execute command '${command.action}': ${result.error}`);
            }
          }
        }
        ui.showResponseWebview(parsedResponse.text);
      } catch (error: any) {
        ui.logOutput(`Error in 'ask' command: ${error}`);
        vscode.window.showErrorMessage(`ChatGPT request failed: ${error.message || error}`);
      } finally {
        ui.showStatusBarMessage('', false);
      }
    }),
    vscode.commands.registerCommand('chatgpt-web.insert', async () => {
      const prompt = await ui.getUserInput('Enter prompt to insert');
      if (!prompt) return;
      ui.showStatusBarMessage('Sending…', true);
      try {
        if (!puppeteerManager.isInitialized()) {
          ui.showStatusBarMessage('Initializing ChatGPT...', true);
          await puppeteerManager.initialize();
        }
        ui.showStatusBarMessage('Sending prompt to ChatGPT for insert...', true);
        const htmlResponse = await puppeteerManager.sendPrompt(prompt);
        const parsedResponse = parser.parse(htmlResponse);
        if (parsedResponse.commands && parsedResponse.commands.length > 0) {
          ui.logOutput(`Executing ${parsedResponse.commands.length} command(s) from ChatGPT for insert...`);
          for (const command of parsedResponse.commands) {
            const result = await commander.execute(command);
            if (result.success) {
              ui.logOutput(`Executed command '${command.action}' for insert: ${JSON.stringify(result.output)}`);
            } else {
              ui.logOutput(`Failed to execute command '${command.action}' for insert: ${result.error}`);
              vscode.window.showWarningMessage(`Failed to execute command '${command.action}' for insert: ${result.error}`);
            }
          }
        }
        await ui.insertIntoEditor(parsedResponse.text);
      } catch (error: any) {
        ui.logOutput(`Error in 'insert' command: ${error}`);
        vscode.window.showErrorMessage(`ChatGPT insert request failed: ${error.message || error}`);
      } finally {
        ui.showStatusBarMessage('', false);
      }
    })
  );
}

export function deactivate() {
  if (puppeteerManager && puppeteerManager.isInitialized()) {
    puppeteerManager.closeBrowser();
  }
}
