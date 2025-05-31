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
        // ...
        ui.showStatusBarMessage('', false);
    }), vscode.commands.registerCommand('chatgpt-web.insert', async () => {
        const prompt = await ui.getUserInput('Enter prompt to insert');
        if (!prompt)
            return;
        ui.showStatusBarMessage('Sending…', true);
        // ...
        ui.showStatusBarMessage('', false);
    }));
}
function deactivate() {
    if (puppeteerManager && puppeteerManager.isInitialized()) {
        puppeteerManager.closeBrowser();
    }
}
//# sourceMappingURL=ExtensionController.js.map