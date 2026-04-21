import React from "react";
import type { AppDefinition, AppState } from "./types";
import type { Root } from "./ink";
import { AppPicker } from "./components/AppPicker";

export function getRenderContext() {
  return {
    renderOptions: {
      stdout: process.stdout,
      stderr: process.stderr,
      stdin: process.stdin,
      patchConsole: false,
      exitOnCtrlC: true,
    },
  };
}

export function showDialog<T>(
  root: Root,
  renderer: (done: (result: T) => void) => React.ReactNode,
): Promise<T> {
  return new Promise<T>(resolve => {
    root.render(renderer(resolve));
  });
}

export async function showSetupScreens(
  root: Root,
  apps: AppDefinition[],
  selectedId?: string,
): Promise<string> {
  if (selectedId) {
    return selectedId;
  }

  return showDialog<string>(root, done => (
    <AppPicker
      apps={apps}
      selectedId={selectedId}
      title="Mock TUI architecture shell"
      onSelect={done}
    />
  ));
}

export async function renderAndRun(root: Root, element: React.ReactNode): Promise<void> {
  root.render(element);
  await root.waitUntilExit();
}

export async function exitWithMessage(message: string): Promise<never> {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

export function buildInitialState(state: AppState): AppState {
  return state;
}
