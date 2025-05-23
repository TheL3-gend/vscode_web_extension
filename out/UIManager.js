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
        this.md = new markdown_it_1.default();
        this.statusBarItem.show();
    }
    showStatusBarMessage(message, isLoading = false) {
        this.statusBarItem.text = isLoading ? `$(sync~spin) ${message}` : message;
        this.statusBarItem.show();
    }
    logOutput(message) {
        const t = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${t}] ${message}`);
        this.outputChannel.show(true);
    }
    getUserInput(prompt) { return vscode.window.showInputBox({ prompt, ignoreFocusOut: true }); }
    showResponseWebview(mdContent) {
        const body = this.md.render(mdContent);
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel('chatgptWebResponse', 'ChatGPT Response', { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, { enableScripts: false });
            this.panel.onDidDispose(() => this.panel = undefined);
        }
        this.panel.webview.html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>ChatGPT Response</title></head><body><div>${body}</div></body></html>`;
        this.panel.reveal(vscode.ViewColumn.Beside);
    }
    async insertIntoEditor(text) {
        const ed = vscode.window.activeTextEditor;
        if (!ed) {
            vscode.window.showErrorMessage('No editor to insert into.');
            return;
        }
        await ed.edit(b => b.insert(ed.selection.active, text));
    }
}
exports.UIManager = UIManager;
//# sourceMappingURL=UIManager.js.map