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
    constructor(uiManager) {
        this.browser = null;
        this.page = null;
        this.initialized = false;
        this.uiManager = uiManager;
        this.loadConfiguration();
    }
    loadConfiguration() {
        const cfg = vscode.workspace.getConfiguration('chatgpt-web');
        this.executablePath = cfg.get('executablePath') || undefined; // undefined makes puppeteer use its default
        // Use boolean or "shell" for headless, as supported by current Puppeteer version
        const headlessConfig = cfg.get('headless', true);
        this.headless = headlessConfig ? true : false;
        this.launchArgs = cfg.get('launchArgs', ['--no-sandbox', '--disable-dev-shm-usage']);
        this.maxRetries = cfg.get('retry.maxRetries', 3);
        this.retryDelay = cfg.get('retry.delay', 1000);
        this.promptTextareaSelector = cfg.get('selectors.promptTextarea', '[data-testid="prompt-textarea"]');
        this.completionIndicatorSelector = cfg.get('selectors.completionIndicator', '[data-testid="regenerate-response-button"]');
        // Ensure a valid default for responseContainer if the config is somehow empty
        this.responseContainerSelector = cfg.get('selectors.responseContainer') || 'div.markdown';
        if (!this.responseContainerSelector) {
            this.log('Warning: selectors.responseContainer is empty in config, using default "div.markdown".');
            this.responseContainerSelector = 'div.markdown';
        }
        this.initialLoadTimeout = cfg.get('timeouts.initialLoad', 30000);
        this.responseTimeout = cfg.get('timeouts.response', 60000);
    }
    log(message, type = 'info') {
        const fullMessage = `PuppeteerManager: ${message}`;
        if (this.uiManager) {
            this.uiManager.logOutput(fullMessage);
        }
        else {
            // Fallback to console if UIManager is not available (e.g., during early constructor phase)
            if (type === 'error')
                console.error(fullMessage);
            else if (type === 'warn')
                console.warn(fullMessage);
            else
                console.log(fullMessage);
        }
    }
    isInitialized() {
        return this.initialized && this.page !== null && this.browser !== null && this.isBrowserConnected();
    }
    isBrowserConnected() {
        return this.browser?.isConnected() || false;
    }
    async initialize() {
        if (this.isInitialized()) {
            this.log('Already initialized.');
            return;
        }
        this.loadConfiguration(); // Reload config in case it changed
        // Check for executable path if not using Puppeteer's bundled Chromium
        if (this.executablePath) {
            let exists = false;
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(this.executablePath));
                exists = true;
            }
            catch {
                exists = false;
            }
            if (!exists) {
                const errorMsg = `Chrome/Chromium executable not found at specified path: ${this.executablePath}. Please check 'chatgpt-web.executablePath' setting.`;
                this.log(errorMsg, 'error');
                throw new Error(errorMsg);
            }
        }
        this.log(`Attempting to launch browser (headless: ${this.headless}, path: ${this.executablePath || 'default'})`);
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.log(`Initialize attempt ${attempt}/${this.maxRetries}...`);
                const launchOptions = {
                    headless: this.headless,
                    executablePath: this.executablePath,
                    args: this.launchArgs,
                };
                // If headless is false, and no executablePath is set, Puppeteer might not find Chrome.
                // Consider adding userDataDir for persistent login if headless is false.
                // if (!this.headless) {
                //   // launchOptions.userDataDir = context.globalStorageUri.fsPath; // Example path
                // }
                this.browser = await puppeteer_core_1.default.launch(launchOptions);
                this.browser.on('disconnected', () => {
                    this.log('Browser disconnected.', 'warn');
                    this.initialized = false;
                    this.browser = null;
                    this.page = null;
                    // Optionally, inform the user or attempt to re-initialize
                    vscode.window.showWarningMessage('ChatGPT browser session disconnected. You may need to re-run the command.');
                });
                this.page = await this.browser.newPage();
                this.log('New page created. Navigating to chat.openai.com...');
                await this.page.goto('https://chat.openai.com', { waitUntil: 'networkidle2', timeout: this.initialLoadTimeout });
                this.log('Navigation successful. Waiting for prompt textarea selector...');
                await this.page.waitForSelector(this.promptTextareaSelector, { timeout: this.initialLoadTimeout });
                this.log('Prompt textarea found. Puppeteer initialized successfully.');
                this.initialized = true;
                return;
            }
            catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                this.log(`Initialization attempt ${attempt} failed: ${errMsg}`, 'error');
                if (this.browser) {
                    await this.browser.close().catch(e => this.log(`Error closing browser during failed init: ${e instanceof Error ? e.message : String(e)}`, 'error'));
                    this.browser = null;
                    this.page = null;
                }
                if (attempt === this.maxRetries) {
                    throw new Error(`Failed to initialize Puppeteer after ${this.maxRetries} attempts: ${errMsg}. Common issues: incorrect executablePath, network problems, or changes in OpenAI's website structure.`);
                }
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            }
        }
    }
    async sendPrompt(prompt) {
        if (!this.isInitialized() || !this.page) { // Rely on isInitialized for full check
            this.log('Not initialized or page is null. Attempting re-initialization.', 'warn');
            await this.initialize(); // Attempt to re-initialize
            if (!this.isInitialized() || !this.page) { // Check again after re-initialization attempt
                throw new Error('PuppeteerManager is not initialized. Cannot send prompt.');
            }
        }
        // Ensure page is not null after check (TypeScript compiler needs this)
        const page = this.page;
        this.log(`Sending prompt. Length: ${prompt.length}`);
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.log(`Send prompt attempt ${attempt}/${this.maxRetries}...`);
                await page.waitForSelector(this.promptTextareaSelector, { timeout: this.responseTimeout });
                await page.focus(this.promptTextareaSelector);
                // Clear the textarea: Method 1 (JS evaluation)
                await page.evaluate((selector) => {
                    const el = document.querySelector(selector);
                    if (el)
                        el.value = '';
                }, this.promptTextareaSelector);
                // Clear the textarea: Method 2 (keyboard triple click + delete - sometimes more robust)
                // await page.click(this.promptTextareaSelector, { clickCount: 3 });
                // await page.keyboard.press('Backspace');
                await page.type(this.promptTextareaSelector, prompt, { delay: 20 }); // Small delay can help with some UIs
                // Click the send button if Enter doesn't work or to be more explicit
                // This assumes a send button selector exists. If not, Enter is fine.
                // const sendButtonSelector = 'button[data-testid="send-button"]'; // Example
                // await page.waitForSelector(sendButtonSelector, { timeout: 5000 });
                // await page.click(sendButtonSelector);
                // OR, if Enter key submits:
                await page.keyboard.press('Enter');
                this.log('Prompt submitted. Waiting for completion indicator...');
                // Wait for the completion indicator (e.g., regenerate button appears or send button becomes active again)
                await page.waitForSelector(this.completionIndicatorSelector, { timeout: this.responseTimeout });
                this.log('Completion indicator found. Waiting for response container...');
                // Additional short wait for content to fully render in the response container
                await page.waitForFunction((selector) => document.querySelector(selector)?.innerHTML.trim() !== '', { timeout: 10000 }, // Wait up to 10 seconds for content to appear
                this.responseContainerSelector);
                this.log('Response container has content.');
                // Get the last response element. ChatGPT often wraps responses in divs.
                // This might need adjustment if the structure of chat.openai.com changes.
                const htmlContent = await page.evaluate((selector) => {
                    const responseElements = Array.from(document.querySelectorAll(selector));
                    // Assuming the last element with class 'markdown' in the message list is the latest response.
                    // This selector might need to be more specific, e.g. within the last message group.
                    const lastResponseElement = responseElements.pop(); // Get the last one
                    return lastResponseElement ? lastResponseElement.innerHTML : '';
                }, this.responseContainerSelector);
                if (!htmlContent) {
                    this.log('Response container found, but no HTML content extracted.', 'warn');
                    // This could happen if the selector is right but the element is empty.
                    // Or if the completion indicator appeared but the content isn't in the expected place.
                    // Retry if appropriate.
                    if (attempt < this.maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                        continue;
                    }
                    throw new Error('Response container found, but failed to extract HTML content.');
                }
                this.log(`Received response HTML. Length: ${htmlContent.length}`);
                return htmlContent;
            }
            catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                this.log(`Send prompt attempt ${attempt} failed: ${errMsg}`, 'error');
                // Check if browser disconnected
                if (!this.isBrowserConnected()) {
                    this.log('Browser disconnected during sendPrompt. Attempting to re-initialize.', 'warn');
                    this.initialized = false; // Force re-init on next call
                    throw new Error('Browser disconnected during operation. Please try again.');
                }
                if (attempt === this.maxRetries) {
                    throw new Error(`Failed to send prompt and get response after ${this.maxRetries} attempts: ${errMsg}`);
                }
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            }
        }
        // Should not be reached if maxRetries is > 0, but as a fallback:
        throw new Error('Failed to send prompt after all retries (unexpected).');
    }
    async closeBrowser() {
        this.initialized = false;
        if (this.browser) {
            try {
                this.log('Closing browser...');
                await this.browser.close();
                this.log('Browser closed successfully.');
            }
            catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                this.log(`Error closing browser: ${errMsg}`, 'error');
            }
            finally {
                this.browser = null;
                this.page = null;
            }
        }
        else {
            this.log('Browser was not open or already closed.');
        }
    }
}
exports.PuppeteerManager = PuppeteerManager;
//# sourceMappingURL=PuppeteerManager.js.map