import React from "react";
import { Box, Text } from "../ink";
import type { AppDefinition, CommandDefinition } from "../types";

export function HelpPanel(props: {
  app: AppDefinition;
  commands: CommandDefinition[];
}): React.ReactNode {
  const { app, commands } = props;
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={app.accent} padding={1}>
      <Text bold>{app.title} command help</Text>
      {commands.map(command => (
        <Text key={command.name}>
          /{command.name} - {command.description}
        </Text>
      ))}
    </Box>
  );
}
