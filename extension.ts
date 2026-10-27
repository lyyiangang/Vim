/**
 * Extension.ts is a lightweight wrapper around ModeHandler. It converts key
 * events to their string names and passes them on to ModeHandler via
 * handleKeyEvent().
 */
import './src/actions/include-main';
import './src/actions/include-plugins';

/**
 * Load configuration validator
 */

import './src/configuration/validators/inputMethodSwitcherValidator';
import './src/configuration/validators/neovimValidator';
import './src/configuration/validators/remappingValidator';
import './src/configuration/validators/vimrcValidator';

import * as path from 'path';
import * as vscode from 'vscode';
import {
  activate as activateFunc,
  loadConfiguration,
  registerCommand,
  registerEventListener,
} from './extensionBase';
import { vimrc } from './src/configuration/vimrc';
import { Globals } from './src/globals';
import { HistoryTracker } from './src/history/historyTracker';
import { ModeHandlerMap } from './src/mode/modeHandlerMap';
import { Register } from './src/register/register';
import { Logger } from './src/util/logger';

export { getAndUpdateModeHandler } from './extensionBase';

function collectAndSaveMarks() {
  const localMarksPerFile = [];
  for (const [, modeHandler] of ModeHandlerMap.entries()) {
    localMarksPerFile.push({
      uri: modeHandler.vimState.document.uri.toString(),
      marks: modeHandler.vimState.historyTracker.getLocalMarks(),
    });
  }
  return HistoryTracker.saveMarksToDisk(localMarksPerFile).catch((e) => {
    Logger.warn(`Failed to save marks: ${e}`);
  });
}

export async function activate(context: vscode.ExtensionContext) {
  // Set the storage path to be used by history files
  Globals.extensionStoragePath = context.globalStorageUri.fsPath;

  await activateFunc(context);

  registerEventListener(context, vscode.workspace.onDidSaveTextDocument, async (document) => {
    if (vimrc.vimrcPath && path.relative(document.fileName, vimrc.vimrcPath) === '') {
      await loadConfiguration();
      Logger.info('Sourced new .vimrc');
    }
    // Save marks whenever any file is saved
    await collectAndSaveMarks();
  });

  // Also save marks when switching editors
  registerEventListener(context, vscode.window.onDidChangeActiveTextEditor, async () => {
    await collectAndSaveMarks();
  });

  registerCommand(
    context,
    'vim.editVimrc',
    async () => {
      if (vimrc.vimrcPath) {
        const document = await vscode.workspace.openTextDocument(vimrc.vimrcPath);
        await vscode.window.showTextDocument(document);
      } else {
        await vscode.window.showWarningMessage('No .vimrc found. Please set `vim.vimrc.path`.');
      }
    },
    false,
  );
}

export async function deactivate() {
  await Register.saveToDisk(true);
  await collectAndSaveMarks();
}
