import { JSDOM } from 'jsdom';
import { VSCodeCommand } from './VSCodeCommander';

export interface CodeBlock {
  language: string;
  code: string;
}

export interface ParsedResponse {
  text: string; // The main textual response from ChatGPT
  codeBlocks: CodeBlock[]; // Any extracted code blocks
  commands: VSCodeCommand[]; // Parsed VSCODE_COMMANDs
}

export interface IResponseParser {
  parse(htmlResponseContent: string): ParsedResponse;
}

export class ResponseParser implements IResponseParser {
  public parse(htmlResponseContent: string): ParsedResponse {
    if (!htmlResponseContent || typeof htmlResponseContent !== 'string') {
      console.warn('ResponseParser: Received empty or invalid HTML content.');
      return { text: '', codeBlocks: [], commands: [] };
    }

    // Wrap the HTML so we can parse it
    const dom = new JSDOM(`<!DOCTYPE html><body>${htmlResponseContent}</body>`).window.document;
    const responseRoot = dom.body.firstElementChild || dom.body;

    let fullTextPieces: string[] = [];
    const codeBlocks: CodeBlock[] = [];
    const commands: VSCodeCommand[] = [];

    // Walk through child nodes in order to preserve text + code structure
    responseRoot.childNodes.forEach((node) => {
      if (node.nodeType === node.TEXT_NODE) {
        // Plain text node
        const txt = node.textContent || '';
        fullTextPieces.push(txt);
      } else if (node.nodeType === node.ELEMENT_NODE) {
        const element = node as HTMLElement;

        // Handle code blocks: <pre><code class="language-xxx">...</code></pre>
        if (element.tagName === 'PRE') {
          const codeElem = element.querySelector('code');
          if (codeElem) {
            // Determine language from class="language-xxx"
            const className = codeElem.getAttribute('class') || '';
            const langMatch = className.match(/language-(\w+)/);
            const language = langMatch ? langMatch[1] : '';

            const codeText = codeElem.textContent || '';
            codeBlocks.push({ language, code: codeText });

            // If it's JSON, try to parse into a VSCodeCommand
            if (language.toLowerCase() === 'json') {
              try {
                const parsed = JSON.parse(codeText);
                // If parsed is an array of commands or single command
                if (Array.isArray(parsed)) {
                  parsed.forEach((entry: any) => {
                    if (
                      typeof entry === 'object' &&
                      typeof entry.action === 'string' &&
                      typeof entry.params === 'object'
                    ) {
                      commands.push({ action: entry.action, params: entry.params });
                    }
                  });
                } else if (
                  typeof parsed === 'object' &&
                  typeof parsed.action === 'string' &&
                  typeof parsed.params === 'object'
                ) {
                  commands.push({ action: parsed.action, params: parsed.params });
                }
              } catch {
                // If JSON.parse fails, just ignore
              }
            }

            // Add a placeholder in the text so final "text" does not contain the raw code again
            fullTextPieces.push(`\n\n[Code block in ${language} omitted]\n\n`);
          } else {
            // <pre> without <code>—treat innerText as fallback
            const fallbackText = element.textContent || '';
            fullTextPieces.push(fallbackText);
          }
        }
        // Handle inline code: <code>...</code> outside of a <pre>
        else if (element.tagName === 'CODE' && !element.parentElement?.tagName.match(/PRE/)) {
          const inline = element.textContent || '';
          fullTextPieces.push(inline);
        }
        // Handle paragraphs, lists, etc.
        else {
          // For any other element (p, div, span, etc.), use its textContent
          const txt = element.textContent || '';
          fullTextPieces.push(txt);
        }
      }
    });

    const combinedText = fullTextPieces.join('').trim();
    return { text: combinedText, codeBlocks, commands };
  }
}