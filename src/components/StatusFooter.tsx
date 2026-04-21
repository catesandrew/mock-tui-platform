import React from "react";
import { Box, Text } from "../ink";
import type { AppDefinition, FocusMode, MockNotification } from "../types";

export function StatusFooter(props: {
  app: AppDefinition;
  focusMode: FocusMode;
  statusLine: string;
  notifications: MockNotification[];
  tasksCount: number;
  searchTerm: string;
}): React.ReactNode {
  const { app, focusMode, statusLine, notifications, tasksCount, searchTerm } = props;
  const latest = notifications[notifications.length - 1];

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={app.accent} padding={1}>
      <Text>
        {app.title} · focus:{focusMode} · tasks:{tasksCount} · search:
        {searchTerm ? ` ${searchTerm}` : " off"}
      </Text>
      <Text>{statusLine}</Text>
      {latest ? <Text dimColor>{latest.title}: {latest.body}</Text> : null}
    </Box>
  );
}
