import React, { createContext, useContext, useMemo, useState, useSyncExternalStore } from "react";
import type { AppState } from "../types";
import { createStore, type Store } from "./store";

const AppStoreContext = createContext<Store<AppState> | null>(null);

export function AppStateProvider(props: {
  initialState: AppState;
  children: React.ReactNode;
}): React.ReactNode {
  const { initialState, children } = props;
  const [store] = useState(() => createStore(initialState));
  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>;
}

function useStore(): Store<AppState> {
  const store = useContext(AppStoreContext);
  if (!store) {
    throw new Error("App state is not available outside AppStateProvider");
  }
  return store;
}

export function useAppState<T>(selector: (state: AppState) => T): T {
  const store = useStore();
  const getSnapshot = useMemo(() => () => selector(store.getState()), [selector, store]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export function useSetAppState(): Store<AppState>["setState"] {
  return useStore().setState;
}

export function useAppStateStore(): Store<AppState> {
  return useStore();
}
