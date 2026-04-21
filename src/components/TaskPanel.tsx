import React from "react";
import { Box, Text } from "../ink";
import type { MockTask } from "../types";

export function TaskPanel(props: { tasks: MockTask[] }): React.ReactNode {
  const { tasks } = props;
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Text bold>Task list</Text>
      {tasks.map(task => (
        <Box key={task.id} flexDirection="column" marginTop={1}>
          <Text>
            [{task.status}] {task.subject}
          </Text>
          <Text dimColor>{task.description}</Text>
        </Box>
      ))}
    </Box>
  );
}
