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
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const PuppeteerManager_1 = require("./PuppeteerManager");
const ResponseParser_1 = require("./ResponseParser");
const VSCodeCommander_1 = require("./VSCodeCommander");
const UIManager_1 = require("./UIManager");
let puppeteerManager;
function activate(context) {
    puppeteerManager = new PuppeteerManager_1.PuppeteerManager();
    const parser = new ResponseParser_1.ResponseParser();
    const commander = new VSCodeCommander_1.VSCodeCommander();
    const ui = new UIManager_1.UIManager();
    context.subscriptions.push(vscode.commands.registerCommand('chatgpt-web.ask', async () => {
        const prompt = await ui.getUserInput('Enter prompt');
        if (!prompt)
            return;
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
                    }
                    else {
                        ui.logOutput(`Failed to execute command '${command.action}': ${result.error}`);
                        vscode.window.showWarningMessage(`Failed to execute command '${command.action}': ${result.error}`);
                    }
                }
            }
            ui.showResponseWebview(parsedResponse.text);
        }
        catch (error) {
            ui.logOutput(`Error in 'ask' command: ${error}`);
            vscode.window.showErrorMessage(`ChatGPT request failed: ${error.message || error}`);
        }
        finally {
            ui.showStatusBarMessage('', false);
        }
    }), vscode.commands.registerCommand('chatgpt-web.insert', async () => {
        const prompt = await ui.getUserInput('Enter prompt to insert');
        if (!prompt)
            return;
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
                    }
                    else {
                        ui.logOutput(`Failed to execute command '${command.action}' for insert: ${result.error}`);
                        vscode.window.showWarningMessage(`Failed to execute command '${command.action}' for insert: ${result.error}`);
                    }
                }
            }
            await ui.insertIntoEditor(parsedResponse.text);
        }
        catch (error) {
            ui.logOutput(`Error in 'insert' command: ${error}`);
            vscode.window.showErrorMessage(`ChatGPT insert request failed: ${error.message || error}`);
        }
        finally {
            ui.showStatusBarMessage('', false);
        }
    }));
}
function deactivate() {
    if (puppeteerManager && puppeteerManager.isInitialized()) {
        puppeteerManager.closeBrowser();
    }
}
//# sourceMappingURL=ExtensionController.js.map