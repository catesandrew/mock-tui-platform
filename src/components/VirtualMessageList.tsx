import React, { useMemo } from "react";
import { Box, Text } from "../ink";
import { useVirtualWindow } from "../hooks/useVirtualWindow";
import type { TranscriptMessage } from "../types";
import { MessageRow } from "./MessageRow";

export function VirtualMessageList(props: {
  messages: TranscriptMessage[];
  visibleCount: number;
  offsetFromBottom: number;
  searchTerm: string;
}): React.ReactNode {
  const { messages, visibleCount, offsetFromBottom, searchTerm } = props;
  const windowed = useVirtualWindow(messages, visibleCount, offsetFromBottom);
  const hiddenAbove = windowed.start;
  const hiddenBelow = messages.length - windowed.end;

  const stableMessages = useMemo(() => windowed.visible, [windowed.visible]);

  return (
    <Box flexDirection="column">
      {hiddenAbove > 0 ? (
        <Text dimColor>{hiddenAbove} older message(s) hidden above</Text>
      ) : null}
      {stableMessages.map(message => (
        <MessageRow key={message.id} message={message} searchTerm={searchTerm} />
      ))}
      {hiddenBelow > 0 ? (
        <Text dimColor>{hiddenBelow} newer message(s) hidden below</Text>
      ) : null}
    </Box>
  );
}
