import { JSDOM } from 'jsdom';
import { VSCodeCommand } from './VSCodeCommander'; // Use the interface from VSCodeCommander

// Renamed 'Command' to 'ParsedVSCodeCommand' to avoid conflict if VSCodeCommand itself is imported directly.
// However, since we are using VSCodeCommand from './VSCodeCommander', we can align the names.
// Let's stick to VSCodeCommand as it's defined in VSCodeCommander.ts

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
        console.warn("ResponseParser: Received empty or invalid HTML content.");
        return { text: '', codeBlocks: [], commands: [] };
    }

    // JSDOM can be slow. If performance is an issue, consider lighter regex-based parsing
    // for simple cases, or a streaming HTML parser for complex content.
    // For now, JSDOM is fine for typical ChatGPT response complexity.
    const dom = new JSDOM(`<!DOCTYPE html><body>${htmlResponseContent}</body>`).window.document;
    
    let fullTextContent = '';
    const codeBlocks: CodeBlock[] = [];

    // Iterate through all direct children of the body (or a more specific response container if known)
    // This aims to preserve the order of text and code blocks.
    // The 'div.markdown' from PuppeteerManager often contains p, pre, ol, ul etc.
    const responseRoot = dom.body.firstElementChild || dom.body; // Usually the div.markdown content

    responseRoot.childNodes.forEach(node => {
      if (node.nodeType === node.TEXT_NODE) {
        fullTextContent += node.textContent;
      } else if (node.nodeType === node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.tagName === 'PRE') {
          const codeElement = element.querySelector('code');
          if (codeElement) {
            const languageMatch = codeElement.className.match(/language-(\w+)/);
            const language = languageMatch ? languageMatch[1] : '';
            const code = codeElement.textContent || '';
            codeBlocks.push({ language, code });
            // Append a placeholder or the code block itself to fullTextContent for command parsing
            fullTextContent += `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
          } else {
            // PRE tag without a CODE tag inside, treat as plain text
            fullTextContent += element.textContent || '';
          }
        } else {
          // For other elements (P, UL, OL, H1-6, BLOCKQUOTE, etc.), get their text content.
          // JSDOM's textContent recursively gets text from children, which is good.
          // Add newlines for block elements to maintain some structure.
          const rawText = element.textContent || '';
          if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'DIV'].includes(element.tagName)) {
            fullTextContent += rawText + '\n\n';
          } else {
            fullTextContent += rawText;
          }
        }
      }
    });
    
    const cleanedFullText = fullTextContent.replace(/\n{3,}/g, '\n\n').trim();
    const commands = this.parseCommands(cleanedFullText); // Parse commands from the combined text

    // The 'text' field in ParsedResponse should be the "displayable" text,
    // which might mean excluding the command syntax. For now, we use the cleaned full text.
    // If commands should be hidden from the webview, filter them out here.
    // For simplicity, current 'text' includes command syntax if it was part of the text.
    // A better approach might be to have a separate "display_text" and "text_for_command_parsing".

    return {
      text: cleanedFullText, // This text will be rendered in Markdown.
      codeBlocks,
      commands
    };
  }

  private parseCommands(str: string): VSCodeCommand[] {
    const parsedCommands: VSCodeCommand[] = [];
    // Regex to find [VSCODE_COMMAND: actionName param1="value1" param2='value2' content="multi
    // line
    // content"]
    // Action is the first word. Params string follows.
    const commandRegex = /\[VSCODE_COMMAND:\s*(\w+)\s+([^\]]+)\]/gs; // 's' flag for dot to match newlines in params
    
    let match;
    while ((match = commandRegex.exec(str)) !== null) {
      const action = match[1];
      const paramsString = match[2];
      const params: Record<string, string> = {};

      // Regex to parse key="value" or key='value' or key=`value`
      // Allows for escaped quotes within values.
      const paramRegex = /(\w+)\s*=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`)/g;
      let paramMatch;
      while ((paramMatch = paramRegex.exec(paramsString)) !== null) {
        // paramMatch[2] for double quotes, [3] for single, [4] for backticks
        const value = paramMatch[2] || paramMatch[3] || paramMatch[4] || '';
        params[paramMatch[1]] = value.replace(/\\(["'`\\])/g, '$1'); // Unescape basic characters
      }
      
      if (Object.keys(params).length > 0 || (action === 'getWorkspaceFiles' || action === 'getDiagnostics' || action === 'getActiveFileInfo' || action === 'getSelection')) {
        // Ensure commands that might not have params are still added if the action name is valid
         parsedCommands.push({ action, params });
      } else if (action && !Object.keys(params).length) {
        // If action is present but no params were parsed, it might be a param-less command.
        // Or it could be a malformed params string. For now, we allow param-less commands.
        const knownParamlessActions = ['getWorkspaceFiles', 'getDiagnostics', 'getActiveFileInfo', 'getSelection'];
        if (knownParamlessActions.includes(action)) {
            parsedCommands.push({ action, params: {} });
        } else {
            console.warn(`ResponseParser: Command action '${action}' found but no valid parameters parsed from '${paramsString}'. Skipping command.`);
        }
      }
    }
    return parsedCommands;
  }
}