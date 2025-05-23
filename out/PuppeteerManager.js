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
exports.PuppeteerManager = void 0;
const vscode = __importStar(require("vscode"));
const puppeteer_core_1 = __importDefault(require("puppeteer-core"));
class PuppeteerManager {
    constructor() {
        this.browser = null;
        this.page = null;
        this.initialized = false;
        this.logChannel = vscode.window.createOutputChannel('ChatGPT Web');
    }
    isInitialized() {
        return this.initialized;
    }
    async initialize() {
        const cfg = vscode.workspace.getConfiguration('chatgpt-web');
        const executablePath = cfg.get('executablePath');
        const headless = cfg.get('headless', true);
        const launchArgs = cfg.get('launchArgs', ['--no-sandbox', '--disable-dev-shm-usage']);
        const maxRetries = cfg.get('retry.maxRetries', 3);
        const retryDelay = cfg.get('retry.delay', 1000);
        const promptSelector = cfg.get('selectors.promptTextarea', '[data-testid="prompt-textarea"]');
        const timeout = cfg.get('timeouts.initialLoad', 20000);
        for (let i = 1; i <= maxRetries; i++) {
            try {
                this.logChannel.appendLine(`Initialize attempt ${i}/${maxRetries}`);
                this.browser = await puppeteer_core_1.default.launch({
                    headless,
                    executablePath: executablePath || undefined,
                    args: launchArgs
                });
                this.page = await this.browser.newPage();
                await this.page.goto('https://chat.openai.com', { waitUntil: 'networkidle2' });
                await this.page.waitForSelector(promptSelector, { timeout });
                this.initialized = true;
                this.logChannel.appendLine('Puppeteer initialized');
                return;
            }
            catch (err) {
                this.logChannel.appendLine(`Init error (attempt ${i}): ${err}`);
                if (i === maxRetries) {
                    throw new Error(`Failed to initialize Puppeteer after ${maxRetries} attempts: ${err}`);
                }
                await new Promise(r => setTimeout(r, retryDelay));
            }
        }
    }
    async sendPrompt(prompt) {
        if (!this.initialized || !this.page) {
            throw new Error('PuppeteerManager not initialized');
        }
        const cfg = vscode.workspace.getConfiguration('chatgpt-web');
        const promptSel = cfg.get('selectors.promptTextarea');
        const completionSel = cfg.get('selectors.completionIndicator');
        const responseSel = cfg.get('selectors.responseContainer');
        const maxRetries = cfg.get('retry.maxRetries', 3);
        const retryDelay = cfg.get('retry.delay', 1000);
        const respTimeout = cfg.get('timeouts.response', 30000);
        for (let i = 1; i <= maxRetries; i++) {
            try {
                this.logChannel.appendLine(`sendPrompt attempt ${i}/${maxRetries}`);
                await this.page.focus(promptSel);
                await this.page.evaluate(sel => {
                    const el = document.querySelector(sel);
                    if (el)
                        el.value = '';
                }, promptSel);
                await this.page.type(promptSel, prompt);
                await this.page.keyboard.press('Enter');
                await this.page.waitForSelector(completionSel, { timeout: respTimeout });
                await this.page.waitForSelector(responseSel, { timeout: 5000 });
                const html = await this.page.evaluate(sel => {
                    const el = document.querySelector(sel);
                    return el ? el.innerHTML : '';
                }, responseSel);
                this.logChannel.appendLine('Received response HTML');
                return html;
            }
            catch (err) {
                this.logChannel.appendLine(`sendPrompt error (attempt ${i}): ${err}`);
                if (i === maxRetries) {
                    throw new Error(`Failed to send prompt after ${maxRetries} attempts: ${err}`);
                }
                await new Promise(r => setTimeout(r, retryDelay));
            }
        }
        return '';
    }
    async closeBrowser() {
        if (this.browser) {
            try {
                await this.browser.close();
                this.logChannel.appendLine('Browser closed');
            }
            catch (err) {
                this.logChannel.appendLine(`Error closing browser: ${err}`);
            }
        }
        this.browser = null;
        this.page = null;
        this.initialized = false;
    }
}
exports.PuppeteerManager = PuppeteerManager;
//# sourceMappingURL=PuppeteerManager.js.map