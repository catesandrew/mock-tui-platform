import React from "react";
import type { AppState } from "../types";
import { AppStateProvider } from "../state/AppState";

export function App(props: { initialState: AppState; children: React.ReactNode }): React.ReactNode {
  return <AppStateProvider initialState={props.initialState}>{props.children}</AppStateProvider>;
}
