import * as vscode from 'vscode';
import puppeteer, { Browser, Page, LaunchOptions } from 'puppeteer';
import { IUIManager } from './UIManager'; // Import IUIManager

export interface IPuppeteerManager {
  initialize(): Promise<void>;
  sendPrompt(prompt: string): Promise<string>;
  closeBrowser(): Promise<void>;
  isInitialized(): boolean;
  isBrowserConnected(): boolean;
}

export class PuppeteerManager implements IPuppeteerManager {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private initialized = false;
  private uiManager?: IUIManager; // Store UIManager instance

  // Selectors from extension configuration
  private promptTextareaSelector!: string;
  private completionIndicatorSelector!: string;
  private responseContainerSelector!: string;
  
  // Timeouts from extension configuration
  private initialLoadTimeout!: number;
  private responseTimeout!: number;

  // Retry settings from extension configuration
  private maxRetries!: number;
  private retryDelay!: number;
  
  private executablePath: string | undefined;
  private headless!: boolean; // Puppeteer's headless can be boolean
  private launchArgs!: string[];


  constructor(uiManager?: IUIManager) { // Accept UIManager
    this.uiManager = uiManager;
    this.loadConfiguration();
  }

  private loadConfiguration(): void {
    const cfg = vscode.workspace.getConfiguration('chatgpt-web');
    this.executablePath = cfg.get<string>('executablePath') || undefined; // undefined makes puppeteer use its default
    // Use boolean or "shell" for headless, as supported by current Puppeteer version
    const headlessConfig = cfg.get<boolean>('headless', true);
    this.headless = headlessConfig ? true : false;
    this.launchArgs = cfg.get<string[]>('launchArgs', ['--no-sandbox', '--disable-dev-shm-usage']);
    
    this.maxRetries = cfg.get<number>('retry.maxRetries', 3);
    this.retryDelay = cfg.get<number>('retry.delay', 1000);
    
    this.promptTextareaSelector = cfg.get<string>('selectors.promptTextarea', '[data-testid="prompt-textarea"]');
    this.completionIndicatorSelector = cfg.get<string>('selectors.completionIndicator', '[data-testid="regenerate-response-button"]');
    // Ensure a valid default for responseContainer if the config is somehow empty
    this.responseContainerSelector = cfg.get<string>('selectors.responseContainer') || 'div.markdown'; 
    if (!this.responseContainerSelector) {
        this.log('Warning: selectors.responseContainer is empty in config, using default "div.markdown".');
        this.responseContainerSelector = 'div.markdown';
    }


    this.initialLoadTimeout = cfg.get<number>('timeouts.initialLoad', 30000);
    this.responseTimeout = cfg.get<number>('timeouts.response', 60000);
  }

  private log(message: string, type: 'info' | 'error' | 'warn' = 'info'): void {
    const fullMessage = `PuppeteerManager: ${message}`;
    if (this.uiManager) {
      this.uiManager.logOutput(fullMessage);
    } else {
      // Fallback to console if UIManager is not available (e.g., during early constructor phase)
      if (type === 'error') console.error(fullMessage);
      else if (type === 'warn') console.warn(fullMessage);
      else console.log(fullMessage);
    }
  }

  public isInitialized(): boolean {
    return this.initialized && this.page !== null && this.browser !== null && this.isBrowserConnected();
  }

  public isBrowserConnected(): boolean {
    return this.browser?.isConnected() || false;
  }

  public async initialize(): Promise<void> {
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
      } catch (_e: unknown) {
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
        
        // Build launchOptions with or without executablePath
        const launchOptions = this.executablePath
          ? { headless: this.headless, args: this.launchArgs, executablePath: this.executablePath }
          : { headless: this.headless, args: this.launchArgs };

        this.browser = await puppeteer.launch(launchOptions);
        
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
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.log(`Initialization attempt ${attempt} failed: ${errMsg}`, 'error');
        if (this.browser) {
            await this.browser.close().catch((e: unknown) => this.log(`Error closing browser during failed init: ${e instanceof Error ? e.message : String(e)}`, 'error'));
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

  public async sendPrompt(prompt: string): Promise<string> {
    if (!this.isInitialized() || !this.page) { // Rely on isInitialized for full check
      this.log('Not initialized or page is null. Attempting re-initialization.', 'warn');
      await this.initialize(); // Attempt to re-initialize
      if (!this.isInitialized() || !this.page) { // Check again after re-initialization attempt
        throw new Error('PuppeteerManager is not initialized. Cannot send prompt.');
      }
    }
    // Ensure page is not null after check (TypeScript compiler needs this)
    const page = this.page!;

    this.log(`Sending prompt. Length: ${prompt.length}`);
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.log(`Send prompt attempt ${attempt}/${this.maxRetries}...`);

        await page.waitForSelector(this.promptTextareaSelector, { timeout: this.responseTimeout });
        await page.focus(this.promptTextareaSelector);
        
        // Clear the textarea: Method 1 (JS evaluation)
        await page.evaluate((selector: string) => {
          const el = document.querySelector(selector) as HTMLTextAreaElement;
          if (el) el.value = '';
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
        await page.waitForFunction(
            (selector: string) => document.querySelector(selector)?.innerHTML.trim() !== '',
            { timeout: 10000 }, // Wait up to 10 seconds for content to appear
            this.responseContainerSelector
        );
        this.log('Response container has content.');

        // Get the last response element. ChatGPT often wraps responses in divs.
        // This might need adjustment if the structure of chat.openai.com changes.
        const htmlContent = await page.evaluate((selector: string) => {
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

      } catch (error: unknown) {
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

  public async closeBrowser(): Promise<void> {
    this.initialized = false;
    if (this.browser) {
      try {
        this.log('Closing browser...');
        await this.browser.close();
        this.log('Browser closed successfully.');
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.log(`Error closing browser: ${errMsg}`, 'error');
      } finally {
        this.browser = null;
        this.page = null;
      }
    } else {
      this.log('Browser was not open or already closed.');
    }
  }
}