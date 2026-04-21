import React from "react";
import { Box, Text, useInput } from "../ink";
import type { InkKey } from "../ink";

export function PromptInput(props: {
  active: boolean;
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onToggleFocus: () => void;
  onToggleTasks: () => void;
  onToggleHelp: () => void;
}): React.ReactNode {
  const { active, value, loading, onChange, onSubmit, onToggleFocus, onToggleTasks, onToggleHelp } = props;

  useInput((input: string, key: InkKey) => {
    if (!active) {
      return;
    }

    if (key.ctrl && input === "t") {
      onToggleTasks();
      return;
    }

    if (input === "?") {
      onToggleHelp();
      return;
    }

    if (key.tab) {
      onToggleFocus();
      return;
    }

    if (key.return) {
      onSubmit();
      return;
    }

    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
      return;
    }

    if (!key.ctrl && !key.meta && input) {
      onChange(value + input);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={active ? "cyan" : "gray"} padding={1}>
      <Text>{loading ? "Processing mock turn..." : "Prompt input"}</Text>
      <Text>
        {active ? ">" : " "} {value || "Type a prompt or /command"}
      </Text>
      <Text dimColor>Enter submit · Tab switch focus · Ctrl+T tasks · ? help</Text>
    </Box>
  );
}
