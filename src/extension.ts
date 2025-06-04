import * as vscode from 'vscode';
import * as puppeteer from 'puppeteer';
import { UIManager, IUIManager } from './UIManager';
import { PuppeteerManager, IPuppeteerManager } from './PuppeteerManager';
import { ResponseParser, IResponseParser, ParsedResponse } from './ResponseParser';
import { VSCodeCommander, IVSCodeCommander, VSCodeCommand, CommandExecutionResult } from './VSCodeCommander';

export function activate(context: vscode.ExtensionContext) {
  // Instantiate managers
  const uiManager: IUIManager = new UIManager();
  const puppeteerManager: IPuppeteerManager = new PuppeteerManager(uiManager);
  const responseParser: IResponseParser = new ResponseParser();
  const commander: IVSCodeCommander = new VSCodeCommander();

  // Register "Ask" command
  const askDisposable = vscode.commands.registerCommand('chatgpt-web.ask', async () => {
    try {
      uiManager.showStatusBarMessage('Initializing ChatGPT...', true);
      // Removed direct puppeteer.launch({ headless: false }) call
      await puppeteerManager.initialize();

      const userPrompt = await uiManager.getUserInput('Ask ChatGPT:');
      if (!userPrompt) {
        uiManager.showStatusBarMessage('No prompt provided.', false, 3000);
        return;
      }

      uiManager.showStatusBarMessage('Sending prompt to ChatGPT...', true);
      const htmlResponse = await puppeteerManager.sendPrompt(userPrompt);

      uiManager.showStatusBarMessage('Parsing response...', true);
      const parsed: ParsedResponse = responseParser.parse(htmlResponse);

      // First, execute any VSCodeCommand(s) embedded
      if (parsed.commands.length > 0) {
        for (const cmd of parsed.commands) {
          uiManager.logOutput(`Executing VSCodeCommand: ${JSON.stringify(cmd)}`);
          const result: CommandExecutionResult = await commander.execute(cmd);
          uiManager.logOutput(`Result of ${cmd.action}: success=${result.success}, error=${result.error ?? 'none'}`);
        }
      }

      // Then show the textual response in a Webview
      uiManager.showResponseWebview(parsed.text, 'ChatGPT Web Response');
      uiManager.showStatusBarMessage('ChatGPT response displayed.', false, 3000);
    } catch (error: any) {
      uiManager.logOutput(`Error in chatgpt-web.ask: ${error.message || String(error)}`);
      vscode.window.showErrorMessage(`ChatGPT Web Error: ${error.message || String(error)}`);
      uiManager.showStatusBarMessage('Error occurred. Check output channel.', false, 5000);
    }
  });

  // Register "Insert" command
  const insertDisposable = vscode.commands.registerCommand('chatgpt-web.insert', async () => {
    try {
      uiManager.showStatusBarMessage('Initializing ChatGPT...', true);
      await puppeteerManager.initialize();

      const userPrompt = await uiManager.getUserInput('Ask ChatGPT (insert response into editor):');
      if (!userPrompt) {
        uiManager.showStatusBarMessage('No prompt provided.', false, 3000);
        return;
      }

      uiManager.showStatusBarMessage('Sending prompt to ChatGPT...', true);
      const htmlResponse = await puppeteerManager.sendPrompt(userPrompt);

      uiManager.showStatusBarMessage('Parsing response...', true);
      const parsed: ParsedResponse = responseParser.parse(htmlResponse);

      // Execute embedded commands first
      if (parsed.commands.length > 0) {
        for (const cmd of parsed.commands) {
          uiManager.logOutput(`Executing VSCodeCommand: ${JSON.stringify(cmd)}`);
          const result: CommandExecutionResult = await commander.execute(cmd);
          uiManager.logOutput(`Result of ${cmd.action}: success=${result.success}, error=${result.error ?? 'none'}`);
        }
      }

      // Insert all codeBlocks (concatenate them) or fallback to text
      let toInsert = '';
      if (parsed.codeBlocks.length > 0) {
        parsed.codeBlocks.forEach((cb) => {
          // Wrap in triple backticks if a language is provided
          if (cb.language) {
            toInsert += `\`\`\`${cb.language}\n${cb.code}\n\`\`\`\n\n`;
          } else {
            toInsert += `\`\`\`\n${cb.code}\n\`\`\`\n\n`;
          }
        });
      } else {
        // Just insert the plain text
        toInsert = parsed.text;
      }

      await uiManager.insertIntoEditor(toInsert);
      uiManager.showStatusBarMessage('Inserted ChatGPT response into editor.', false, 3000);
    } catch (error: any) {
      uiManager.logOutput(`Error in chatgpt-web.insert: ${error.message || String(error)}`);
      vscode.window.showErrorMessage(`ChatGPT Web Error: ${error.message || String(error)}`);
      uiManager.showStatusBarMessage('Error occurred. Check output channel.', false, 5000);
    }
  });

  context.subscriptions.push(askDisposable, insertDisposable, {
    dispose: () => uiManager.dispose(),
  });
}

export function deactivate() {
  // Nothing special to clean up for now
}