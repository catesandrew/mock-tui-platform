import React from "react";
import { Box, Text, useApp, useInput, inkRender } from "./ink-runtime";

export { Box, Text, useApp, useInput };
export type InkKey = Parameters<typeof useInput>[0] extends (
  input: string,
  key: infer TKey,
) => unknown
  ? TKey
  : never;

export type Root = {
  render: (node: React.ReactNode) => void;
  unmount: () => void;
  waitUntilExit: () => Promise<void>;
};

export type RenderOptions = Parameters<typeof inkRender>[1];

export async function createRoot(options?: RenderOptions): Promise<Root> {
  let instance: ReturnType<typeof inkRender> | null = null;

  return {
    render(node) {
      if (instance) {
        instance.rerender(node);
        return;
      }

      instance = inkRender(node, options);
    },
    unmount() {
      instance?.unmount();
    },
    waitUntilExit() {
      return instance?.waitUntilExit() ?? Promise.resolve();
    },
  };
}
