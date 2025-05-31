import * as vscode from 'vscode';

export interface VSCodeCommand {
  action: string;
  params: Record<string, string>;
}

export interface CommandExecutionResult {
  action: string;
  success: boolean;
  output?: any;
  error?: string;
}

export interface IVSCodeCommander {
  execute(cmd: VSCodeCommand): Promise<CommandExecutionResult>;
}

export class VSCodeCommander implements IVSCodeCommander {
  private getWorkspaceUri(): vscode.Uri {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) { throw new Error('No workspace folder open'); }
    return folders[0].uri;
  }

  public async execute(cmd: VSCodeCommand): Promise<CommandExecutionResult> {
    try {
      switch (cmd.action) {
        case 'readFile': {
          if (!cmd.params.path) {
            return { action: cmd.action, success: false, error: "Missing 'path' parameter for readFile" };
          }
          const fileUri = vscode.Uri.joinPath(this.getWorkspaceUri(), cmd.params.path);
          const fileContent = await vscode.workspace.fs.readFile(fileUri);
          return { action: cmd.action, success: true, output: Buffer.from(fileContent).toString('utf8') };
        }

        case 'writeFile': {
          if (!cmd.params.path) {
            return { action: cmd.action, success: false, error: "Missing 'path' parameter for writeFile" };
          }
          if (cmd.params.content === undefined) { // Check for undefined, as empty string is valid content
            return { action: cmd.action, success: false, error: "Missing 'content' parameter for writeFile" };
          }
          const confirmWrite = await vscode.window.showWarningMessage(
            `Do you want to allow ChatGPT to write to the file '${cmd.params.path}'?`,
            { modal: true },
            'Yes'
          );
          if (confirmWrite !== 'Yes') {
            return { action: cmd.action, success: false, error: "User denied file write operation" };
          }
          const fileUri = vscode.Uri.joinPath(this.getWorkspaceUri(), cmd.params.path);
          await vscode.workspace.fs.writeFile(fileUri, Buffer.from(cmd.params.content, 'utf8'));
          return { action: cmd.action, success: true };
        }

        case 'executeTerminal': {
          if (!cmd.params.command) {
            return { action: cmd.action, success: false, error: "Missing 'command' parameter for executeTerminal" };
          }
          const confirmTerminal = await vscode.window.showWarningMessage(
            `Do you want to allow ChatGPT to execute the following command in the terminal?\n\nCommand: ${cmd.params.command}`,
            { modal: true },
            'Yes'
          );
          if (confirmTerminal !== 'Yes') {
            return { action: cmd.action, success: false, error: "User denied terminal command execution" };
          }
          const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('ChatGPT');
          terminal.show();
          terminal.sendText(cmd.params.command);
          return { action: cmd.action, success: true, output: "Command sent to terminal" };
        }

        case 'getWorkspaceFiles': {
          const files = await vscode.workspace.findFiles('**/*', null, 100); // Limit to 100 files
          const relativePaths = files.map(uri => uri.fsPath.substring(this.getWorkspaceUri().fsPath.length + 1));
          return { action: cmd.action, success: true, output: relativePaths };
        }

        case 'getDiagnostics': {
          const diagnostics = vscode.languages.getDiagnostics();
          const formattedDiagnostics = diagnostics.map(([uri, diagItems]) => ({
            filePath: uri.fsPath.substring(this.getWorkspaceUri().fsPath.length + 1),
            diagnostics: diagItems.map(d => ({
              message: d.message,
              severity: vscode.DiagnosticSeverity[d.severity],
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
            return { action: cmd.action, success: false, error: "No active text editor" };
          }
          const document = editor.document;
          return {
            action: cmd.action,
            success: true,
            output: {
              filePath: document.uri.fsPath.substring(this.getWorkspaceUri().fsPath.length + 1),
              languageId: document.languageId,
              lineCount: document.lineCount,
              isDirty: document.isDirty,
              isUntitled: document.isUntitled,
            }
          };
        }

        case 'getSelection': {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            return { action: cmd.action, success: false, error: "No active text editor" };
          }
          const selection = editor.selection;
          const selectedText = editor.document.getText(selection);
          return {
            action: cmd.action,
            success: true,
            output: {
              selectedText: selectedText,
              isEmpty: selection.isEmpty,
              range: {
                startLine: selection.start.line,
                startChar: selection.start.character,
                endLine: selection.end.line,
                endChar: selection.end.character,
              }
            }
          };
        }

        default:
          return { action: cmd.action, success: false, error: `Unknown action: ${cmd.action}` };
      }
    } catch (error: any) {
      console.error(`Error executing command '${cmd.action}':`, error);
      return { action: cmd.action, success: false, error: error.message || String(error) };
    }
  }
}
