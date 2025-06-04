import * as vscode from 'vscode';
import * as puppeteer from 'puppeteer';
import { IUIManager } from './UIManager';

export interface IPuppeteerManager {
  initialize(): Promise<void>;
  sendPrompt(prompt: string): Promise<string>;
  closeBrowser(): Promise<void>;
  isInitialized(): boolean;
  isBrowserConnected(): boolean;
}

export class PuppeteerManager implements IPuppeteerManager {
  private browser: puppeteer.Browser | null = null;
  private page: puppeteer.Page | null = null;
  private initialized = false;
  private uiManager?: IUIManager;

  private promptTextareaSelector!: string;
  private completionIndicatorSelector!: string;
  private responseContainerSelector!: string;

  private initialLoadTimeout!: number;
  private responseTimeout!: number;

  private maxRetries!: number;
  private retryDelay!: number;

  private executablePath: string | undefined;
  private headless!: boolean;
  private launchArgs!: string[];

  constructor(uiManager?: IUIManager) {
    this.uiManager = uiManager;
    this.loadConfiguration();
  }

  private loadConfiguration(): void {
    const cfg = vscode.workspace.getConfiguration('chatgpt-web');
    this.executablePath = cfg.get<string>('executablePath') || undefined;
    const headlessConfig = cfg.get<boolean>('headless', true);
    this.headless = headlessConfig ? true : false;
    this.launchArgs = cfg.get<string[]>('launchArgs', ['--no-sandbox', '--disable-dev-shm-usage']);

    this.maxRetries = cfg.get<number>('retry.maxRetries', 3);
    this.retryDelay = cfg.get<number>('retry.delay', 1000);

    this.promptTextareaSelector =
      cfg.get<string>('selectors.promptTextarea', '[data-testid="prompt-textarea"]')!;
    this.completionIndicatorSelector =
      cfg.get<string>('selectors.completionIndicator', '[data-testid="regenerate-response-button"]')!;
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
    this.loadConfiguration();

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
        const launchOptions: puppeteer.LaunchOptions = this.executablePath
          ? { executablePath: this.executablePath }
          : {};

        // Puppeteer v21+ expects headless as a string ('new' or 'false'), otherwise use boolean for older versions
        this.browser = await puppeteer.launch({
          ...launchOptions,
          headless: this.headless,
          args: this.launchArgs,
        });
        this.browser.on('disconnected', () => {
          this.log('Browser disconnected.', 'warn');
          this.initialized = false;
          this.browser = null;
          this.page = null;
          vscode.window.showWarningMessage(
            'ChatGPT browser session disconnected. You may need to re-run the command.'
          );
        });

        this.page = await this.browser.newPage();
        this.log('New page created. Navigating to chat.openai.com...');

        await this.page.goto('https://chat.openai.com', {
          waitUntil: 'networkidle2',
          timeout: this.initialLoadTimeout,
        });
        this.log('Navigation successful. Waiting for prompt textarea selector...');

        await this.page.waitForSelector(this.promptTextareaSelector, { timeout: this.initialLoadTimeout });
        this.log('Prompt textarea found. Puppeteer initialized successfully.');

        this.initialized = true;
        return;
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.log(`Initialization attempt ${attempt} failed: ${errMsg}`, 'error');
        if (this.browser) {
          await this.browser
            .close()
            .catch((e: unknown) =>
              this.log(`Error closing browser during failed init: ${e instanceof Error ? e.message : String(e)}`, 'error')
            );
          this.browser = null;
          this.page = null;
        }
        if (attempt === this.maxRetries) {
          throw new Error(
            `Failed to initialize Puppeteer after ${this.maxRetries} attempts: ${errMsg}. Common issues: incorrect executablePath, network problems, or changes in OpenAI's website structure.`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
      }
    }
  }

  public async sendPrompt(prompt: string): Promise<string> {
    if (!this.isInitialized() || !this.page) {
      this.log('Not initialized or page is null. Attempting re-initialization.', 'warn');
      await this.initialize();
      if (!this.isInitialized() || !this.page) {
        throw new Error('PuppeteerManager is not initialized. Cannot send prompt.');
      }
    }
    const page = this.page!;

    this.log(`Sending prompt. Length: ${prompt.length}`);
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.log(`Send prompt attempt ${attempt}/${this.maxRetries}...`);

        await page.waitForSelector(this.promptTextareaSelector, { timeout: this.responseTimeout });
        await page.focus(this.promptTextareaSelector);

        // Clear the textarea by JS evaluation
        await page.evaluate((selector: string) => {
          const el = document.querySelector(selector) as HTMLTextAreaElement;
          if (el) el.value = '';
        }, this.promptTextareaSelector);

        await page.type(this.promptTextareaSelector, prompt, { delay: 20 });
        await page.keyboard.press('Enter');
        this.log('Prompt submitted. Waiting for completion indicator...');

        await page.waitForSelector(this.completionIndicatorSelector, { timeout: this.responseTimeout });
        this.log('Completion indicator found. Waiting for response container...');

        await page.waitForFunction(
          (selector: string) => document.querySelector(selector)?.innerHTML.trim() !== '',
          { timeout: 10000 },
          this.responseContainerSelector
        );
        this.log('Response container has content.');

        const htmlContent = await page.evaluate((selector: string) => {
          const responseElements = Array.from(document.querySelectorAll(selector));
          const lastResponseElement = responseElements.pop();
          return lastResponseElement ? lastResponseElement.innerHTML : '';
        }, this.responseContainerSelector);

        if (!htmlContent) {
          this.log('Response container found, but no HTML content extracted.', 'warn');
          if (attempt < this.maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
            continue;
          }
          throw new Error('Response container found, but failed to extract HTML content.');
        }

        this.log(`Received response HTML. Length: ${htmlContent.length}`);
        return htmlContent;
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.log(`Send prompt attempt ${attempt} failed: ${errMsg}`, 'error');
        if (!this.isBrowserConnected()) {
          this.log('Browser disconnected during sendPrompt. Attempting to re-initialize.', 'warn');
          this.initialized = false;
          throw new Error('Browser disconnected during operation. Please try again.');
        }
        if (attempt === this.maxRetries) {
          throw new Error(`Failed to send prompt and get response after ${this.maxRetries} attempts: ${errMsg}`);
        }
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
      }
    }
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

  public async sendMessage(message: string): Promise<string> {
    if (!this.page) {
      await this.initialize();
    }

    if (!this.page) {
      throw new Error('Failed to initialize browser');
    }

    try {
      // Wait for the input field and type the message
      await this.page.waitForSelector('[data-testid="prompt-textarea"]');
      await this.page.type('[data-testid="prompt-textarea"]', message);
      await this.page.keyboard.press('Enter');

      // Wait for the response
      await this.page.waitForSelector('[data-testid="regenerate-response-button"]');

      // Get the response text
      const response = await this.page.evaluate(() => {
        const responseElement = document.querySelector('div.markdown');
        return responseElement ? responseElement.textContent : '';
      });

      return response || 'No response received';
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to send message: ${error.message}`);
      }
      throw new Error('Failed to send message: Unknown error');
    }
  }

  public dispose(): void {
    if (this.browser) {
      this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
