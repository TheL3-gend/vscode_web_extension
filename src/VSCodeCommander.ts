import * as vscode from 'vscode';

export interface VSCodeCommand {
  action: string;
  // Ensure params can hold any string value, including empty strings or specific structure.
  params: Record<string, unknown>; // Changed from Record<string, string> to Record<string, unknown> for flexibility
}

export interface CommandExecutionResult {
  action: string;
  success: boolean;
  output?: unknown;
  error?: string;
}

export interface IVSCodeCommander {
  execute(cmd: VSCodeCommand): Promise<CommandExecutionResult>;
}

export class VSCodeCommander implements IVSCodeCommander {
  private getWorkspaceUri(): vscode.Uri {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      throw new Error('No workspace folder is currently open.');
    }
    return folders[0].uri;
  }

  private getFilePath(relativePath: string): vscode.Uri {
    if (typeof relativePath !== 'string' || !relativePath.trim()) {
        throw new Error("Path parameter is invalid or missing.");
    }
    try {
        return vscode.Uri.joinPath(this.getWorkspaceUri(), relativePath);
    } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        throw new Error(`Error constructing file path for "${relativePath}": ${errMsg}`);
    }
  }

  public async execute(cmd: VSCodeCommand): Promise<CommandExecutionResult> {
    try {
      switch (cmd.action) {
        case 'readFile': {
          if (!cmd.params || typeof cmd.params.path !== 'string') {
            return { action: cmd.action, success: false, error: "Missing or invalid 'path' parameter for readFile (must be a string)." };
          }
          const fileUri = this.getFilePath(cmd.params.path);
          const fileContentBytes = await vscode.workspace.fs.readFile(fileUri);
          const fileContent = Buffer.from(fileContentBytes).toString('utf8');
          return { action: cmd.action, success: true, output: fileContent };
        }

        case 'writeFile': {
          if (!cmd.params || typeof cmd.params.path !== 'string') {
            return { action: cmd.action, success: false, error: "Missing or invalid 'path' parameter for writeFile (must be a string)." };
          }
          if (cmd.params.content === undefined || cmd.params.content === null) { // Allow empty string for content
            return { action: cmd.action, success: false, error: "Missing 'content' parameter for writeFile." };
          }
          const contentString = String(cmd.params.content); // Ensure content is a string

          const confirmWrite = await vscode.window.showWarningMessage(
            `Allow ChatGPT to write to the file '${cmd.params.path}'?`,
            { modal: true, detail: `Content preview (first 100 chars):\n${contentString.substring(0, 100)}...` },
            'Yes', 'No'
          );
          if (confirmWrite !== 'Yes') {
            return { action: cmd.action, success: false, error: "User denied file write operation." };
          }
          const fileUri = this.getFilePath(cmd.params.path);
          await vscode.workspace.fs.writeFile(fileUri, Buffer.from(contentString, 'utf8'));
          return { action: cmd.action, success: true, output: `File '${cmd.params.path}' written successfully.` };
        }

        case 'executeTerminal': {
          if (!cmd.params || typeof cmd.params.command !== 'string') {
            return { action: cmd.action, success: false, error: "Missing or invalid 'command' parameter for executeTerminal (must be a string)." };
          }
          const confirmTerminal = await vscode.window.showWarningMessage(
            `Allow ChatGPT to execute the following command in the terminal?\n\nCommand: ${cmd.params.command}`,
            { modal: true },
            'Yes', 'No'
          );
          if (confirmTerminal !== 'Yes') {
            return { action: cmd.action, success: false, error: "User denied terminal command execution." };
          }
          const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('ChatGPT');
          terminal.show();
          terminal.sendText(cmd.params.command, true); // true to execute immediately
          return { action: cmd.action, success: true, output: "Command sent to terminal for execution." };
        }

        case 'getWorkspaceFiles': {
          const maxFiles = vscode.workspace.getConfiguration('chatgpt-web').get<number>('maxFiles', 100);
          const files = await vscode.workspace.findFiles('**/*', null, maxFiles);
          const workspaceRootPath = this.getWorkspaceUri().fsPath;
          const relativePaths = files.map(uri => {
            if (uri.fsPath.startsWith(workspaceRootPath)) {
                return vscode.workspace.asRelativePath(uri, false);
            }
            return uri.fsPath; // For files outside workspace, return full path
          });
          return { action: cmd.action, success: true, output: relativePaths };
        }

        case 'getDiagnostics': {
          const diagnosticsEntries = vscode.languages.getDiagnostics(); // Returns [Uri, Diagnostic[]][]
          const workspaceRootPath = this.getWorkspaceUri().fsPath;
          const formattedDiagnostics = diagnosticsEntries.map(([uri, diagItems]) => ({
            filePath: uri.fsPath.startsWith(workspaceRootPath) ? vscode.workspace.asRelativePath(uri, false) : uri.fsPath,
            diagnostics: diagItems.map(d => ({
              message: d.message,
              severity: vscode.DiagnosticSeverity[d.severity], // Converts enum number to string
              source: d.source,
              code: d.code ? (typeof d.code === 'string' ? d.code : JSON.stringify(d.code)) : undefined,
              range: {
                startLine: d.range.start.line,
                startChar: d.range.start.character,
                endLine: d.range.end.line,
                endChar: d.range.end.character,
              }
            }))
          }));
          return { action: cmd.action, success: true, output: formattedDiagnostics };
        }

        case 'getActiveFileInfo': {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            return { action: cmd.action, success: false, error: "No active text editor found." };
          }
          const document = editor.document;
          const workspaceRootPath = this.getWorkspaceUri().fsPath;
          return {
            action: cmd.action,
            success: true,
            output: {
              filePath: document.uri.fsPath.startsWith(workspaceRootPath) ? vscode.workspace.asRelativePath(document.uri, false) : document.uri.fsPath,
              languageId: document.languageId,
              lineCount: document.lineCount,
              isDirty: document.isDirty,
              isUntitled: document.isUntitled,
              eol: document.eol === vscode.EndOfLine.CRLF ? 'CRLF' : 'LF',
              version: document.version,
            }
          };
        }

        case 'getSelection': {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            return { action: cmd.action, success: false, error: "No active text editor found." };
          }
          if (editor.selection.isEmpty && (!cmd.params || cmd.params.allowEmpty !== true)) {
            return { action: cmd.action, success: false, error: "No text selected. To allow, AI must send {allowEmpty:true}." };
          }
          const selection = editor.selection;
          const selectedText = editor.document.getText(selection);
          return {
            action: cmd.action,
            success: true,
            output: {
              selectedText: selectedText,
              isEmpty: selection.isEmpty,
              isSingleLine: selection.isSingleLine,
              start: { line: selection.start.line, character: selection.start.character },
              end: { line: selection.end.line, character: selection.end.character },
              active: { line: selection.active.line, character: selection.active.character }, // Cursor position
              anchor: { line: selection.anchor.line, character: selection.anchor.character } // Start of selection drag
            }
          };
        }

        default:
          return { action: cmd.action, success: false, error: `Unknown or unsupported action: '${cmd.action}'.` };
      }
    } catch (error: unknown) {
      console.error(`VSCodeCommander: Error executing command '${cmd.action}':`, error);
      // Check if error is an instance of Error, otherwise stringify it
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { action: cmd.action, success: false, error: errorMessage };
    }
  }
}