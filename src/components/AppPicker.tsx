import React, { useState } from "react";
import { Box, Text, useInput } from "../ink";
import type { InkKey } from "../ink";
import type { AppDefinition } from "../types";

export function AppPicker(props: {
  apps: AppDefinition[];
  selectedId?: string;
  onSelect: (appId: string) => void;
  title: string;
}): React.ReactNode {
  const { apps, selectedId, onSelect, title } = props;
  const initialIndex = Math.max(0, apps.findIndex(app => app.id === selectedId));
  const [index, setIndex] = useState(initialIndex);

  useInput((_input: string, key: InkKey) => {
    if (key.upArrow) {
      setIndex(current => (current - 1 + apps.length) % apps.length);
    }
    if (key.downArrow) {
      setIndex(current => (current + 1) % apps.length);
    }
    if (key.return) {
      onSelect(apps[index]!.id);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Text bold>{title}</Text>
      <Text dimColor>Select a mock application shell.</Text>
      <Box marginTop={1} flexDirection="column">
        {apps.map((app, appIndex) => (
          <Text key={app.id} color={appIndex === index ? app.accent : undefined}>
            {appIndex === index ? ">" : " "} {app.id} - {app.subtitle}
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Use ↑/↓ and Enter</Text>
      </Box>
    </Box>
  );
}
