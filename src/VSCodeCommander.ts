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
    // Implementation as defined earlier...
    return { action: cmd.action, success: true };
  }
}
