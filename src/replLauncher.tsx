import React from "react";
import type { Root } from "./ink";
import type { AppState } from "./types";

export async function launchRepl(
  root: Root,
  appProps: { initialState: AppState },
  renderAndRun: (root: Root, element: React.ReactNode) => Promise<void>,
): Promise<void> {
  const { App } = await import("./components/App");
  const { REPL } = await import("./screens/REPL");

  await renderAndRun(
    root,
    <App initialState={appProps.initialState}>
      <REPL />
    </App>,
  );
}
