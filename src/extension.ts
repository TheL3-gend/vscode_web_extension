import * as vscode from 'vscode';
import { PuppeteerManager } from './PuppeteerManager';
import { ResponseParser } from './ResponseParser';
import { VSCodeCommander, IVSCodeCommander } from './VSCodeCommander';
import { UIManager, IUIManager } from './UIManager';

let puppeteerManager: PuppeteerManager | undefined;
let uiManager: IUIManager | undefined;

export function activate(context: vscode.ExtensionContext) {
  uiManager = new UIManager();
  uiManager.logOutput('ChatGPT Web Extension activating...');

  const commander: IVSCodeCommander = new VSCodeCommander();

  // Initialize PuppeteerManager lazily
  const getPuppeteerManager = async (): Promise<PuppeteerManager> => {
    if (!puppeteerManager || !puppeteerManager.isBrowserConnected()) {
        if (uiManager) uiManager.showStatusBarMessage('Initializing ChatGPT browser...', true);
        puppeteerManager = new PuppeteerManager(uiManager); // Pass UIManager for logging
        try {
            await puppeteerManager.initialize();
            if (uiManager) uiManager.showStatusBarMessage('ChatGPT browser initialized.', false);
        } catch (initError: unknown) {
            if (uiManager) {
                const errMsg = initError instanceof Error ? initError.message : String(initError);
                uiManager.logOutput(`Puppeteer initialization failed: ${errMsg}`);
                vscode.window.showErrorMessage(`Failed to initialize ChatGPT browser: ${errMsg}. Please check settings (e.g., executablePath) and ensure you can access chat.openai.com.`);
                uiManager.showStatusBarMessage('Initialization failed.', false);
            }
            throw initError; // Re-throw to stop command execution
        }
    }
    return puppeteerManager;
  };

  const askOrInsertCommand = async (isInsertMode: boolean) => {
    if (!uiManager) {
        console.error("UIManager not initialized in askOrInsertCommand");
        return;
    }

    const prompt = await uiManager.getUserInput(isInsertMode ? 'Enter prompt for insertion' : 'Enter your prompt for ChatGPT');
    if (!prompt) return;

    uiManager.showStatusBarMessage('ChatGPT: Thinking…', true);
    try {
      const currentPuppeteerManager = await getPuppeteerManager();
      uiManager.logOutput(`Sending prompt (insert: ${isInsertMode}): "${prompt}"`);
      
      const htmlResponse = await currentPuppeteerManager.sendPrompt(prompt);
      uiManager.logOutput('Received HTML response from ChatGPT.');

      const parser = new ResponseParser(); // Create parser instance here
      const parsedResponse = parser.parse(htmlResponse);
      uiManager.logOutput(`Parsed response. Text length: ${parsedResponse.text.length}, Commands: ${parsedResponse.commands.length}`);

      if (parsedResponse.commands && parsedResponse.commands.length > 0) {
        uiManager.logOutput(`Executing ${parsedResponse.commands.length} command(s) from ChatGPT...`);
        for (const command of parsedResponse.commands) {
          uiManager.logOutput(`Executing command: ${command.action} with params: ${JSON.stringify(command.params)}`);
          const result = await commander.execute(command);
          if (result.success) {
            uiManager.logOutput(`Successfully executed '${command.action}'. Output: ${result.output ? JSON.stringify(result.output) : 'N/A'}`);
          } else {
            uiManager.logOutput(`Failed to execute command '${command.action}': ${result.error}`);
            vscode.window.showWarningMessage(`ChatGPT command '${command.action}' failed: ${result.error}`);
          }
        }
      }

      if (isInsertMode) {
        await uiManager.insertIntoEditor(parsedResponse.text);
        uiManager.logOutput('Inserted response into editor.');
        vscode.window.showInformationMessage('ChatGPT response inserted.');
      } else {
        uiManager.showResponseWebview(parsedResponse.text, "ChatGPT Response");
        uiManager.logOutput('Displayed response in webview.');
      }

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      uiManager.logOutput(`Error during ChatGPT interaction: ${errMsg}`);
      vscode.window.showErrorMessage(`ChatGPT request failed: ${errMsg}`);
    } finally {
      uiManager.showStatusBarMessage('ChatGPT: Ready', false);
      setTimeout(() => { // Clear status bar after a few seconds if it's just "Ready"
        if (uiManager && uiManager.getCurrentStatusBarText() === 'ChatGPT: Ready') {
            uiManager.clearStatusBarMessage();
        }
      }, 5000);
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('chatgpt-web.ask', () => askOrInsertCommand(false)),
    vscode.commands.registerCommand('chatgpt-web.insert', () => askOrInsertCommand(true))
  );

  uiManager.logOutput('ChatGPT Web Extension activated.');
}

export async function deactivate() {
  if (uiManager) {
    uiManager.logOutput('ChatGPT Web Extension deactivating...');
  }
  if (puppeteerManager) {
    await puppeteerManager.closeBrowser();
    if (uiManager) {
        uiManager.logOutput('Puppeteer browser closed.');
    }
  }
  if (uiManager) {
    uiManager.dispose(); // Clean up UI resources like status bar
  }
}