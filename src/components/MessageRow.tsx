import React from "react";
import { Box, Text } from "../ink";
import type { TranscriptMessage } from "../types";

function roleColor(message: TranscriptMessage): string | undefined {
  if (message.role === "user") return "cyan";
  if (message.role === "assistant") return "green";
  if (message.role === "tool") return "yellow";
  return "white";
}

export const MessageRow = React.memo(function MessageRow(props: {
  message: TranscriptMessage;
  searchTerm: string;
}): React.ReactNode {
  const { message, searchTerm } = props;
  const showSearchMarker =
    searchTerm.length > 0 &&
    message.content.toLowerCase().includes(searchTerm.toLowerCase());

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={roleColor(message)}>
        {message.title ? `${message.title} · ` : ""}
        {message.role.toUpperCase()}
      </Text>
      <Text wrap="wrap">
        {showSearchMarker ? "[match] " : ""}
        {message.content}
      </Text>
    </Box>
  );
});
