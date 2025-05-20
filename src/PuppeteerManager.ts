import * as vscode from 'vscode';
import puppeteer, { Browser, Page } from 'puppeteer-core';

export interface IPuppeteerManager {
  initialize(): Promise<void>;
  sendPrompt(prompt: string): Promise<string>;
  closeBrowser(): Promise<void>;
  isInitialized(): boolean;
}

export class PuppeteerManager implements IPuppeteerManager {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private initialized = false;
  private logChannel = vscode.window.createOutputChannel('ChatGPT Web');

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async initialize(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('chatgpt-web');
    const executablePath = cfg.get<string>('executablePath');
    const headless = cfg.get<boolean>('headless', true);
    const launchArgs = cfg.get<string[]>('launchArgs', ['--no-sandbox', '--disable-dev-shm-usage']);
    const maxRetries = cfg.get<number>('retry.maxRetries', 3);
    const retryDelay = cfg.get<number>('retry.delay', 1000);
    const promptSelector = cfg.get<string>('selectors.promptTextarea', '[data-testid="prompt-textarea"]');
    const timeout = cfg.get<number>('timeouts.initialLoad', 20000);

    for (let i = 1; i <= maxRetries; i++) {
      try {
        this.logChannel.appendLine(`Initialize attempt ${i}/${maxRetries}`);
        this.browser = await puppeteer.launch({
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
      } catch (err) {
        this.logChannel.appendLine(`Init error (attempt ${i}): ${err}`);
        if (i === maxRetries) {
          throw new Error(`Failed to initialize Puppeteer after ${maxRetries} attempts: ${err}`);
        }
        await new Promise(r => setTimeout(r, retryDelay));
      }
    }
  }

  public async sendPrompt(prompt: string): Promise<string> {
    if (!this.initialized || !this.page) {
      throw new Error('PuppeteerManager not initialized');
    }

    const cfg = vscode.workspace.getConfiguration('chatgpt-web');
    const promptSel = cfg.get<string>('selectors.promptTextarea')!;
    const completionSel = cfg.get<string>('selectors.completionIndicator')!;
    const responseSel = cfg.get<string>('selectors.responseContainer')!;
    const maxRetries = cfg.get<number>('retry.maxRetries', 3);
    const retryDelay = cfg.get<number>('retry.delay', 1000);
    const respTimeout = cfg.get<number>('timeouts.response', 30000);

    for (let i = 1; i <= maxRetries; i++) {
      try {
        this.logChannel.appendLine(`sendPrompt attempt ${i}/${maxRetries}`);
        await this.page.focus(promptSel);
        await this.page.evaluate(sel => {
          const el = document.querySelector(sel) as HTMLTextAreaElement;
          if (el) el.value = '';
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
      } catch (err) {
        this.logChannel.appendLine(`sendPrompt error (attempt ${i}): ${err}`);
        if (i === maxRetries) {
          throw new Error(`Failed to send prompt after ${maxRetries} attempts: ${err}`);
        }
        await new Promise(r => setTimeout(r, retryDelay));
      }
    }
    return '';
  }

  public async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.logChannel.appendLine('Browser closed');
      } catch (err) {
        this.logChannel.appendLine(`Error closing browser: ${err}`);
      }
    }
    this.browser = null;
    this.page = null;
    this.initialized = false;
  }
}
