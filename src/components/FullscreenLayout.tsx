import React from "react";
import { Box } from "../ink";

export function FullscreenLayout(props: {
  scrollable: React.ReactNode;
  panel?: React.ReactNode;
  footer: React.ReactNode;
  prompt: React.ReactNode;
}): React.ReactNode {
  const { scrollable, panel, footer, prompt } = props;

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" minHeight={18}>
        {scrollable}
      </Box>
      {panel ? <Box marginTop={1}>{panel}</Box> : null}
      <Box marginTop={1}>{footer}</Box>
      <Box marginTop={1}>{prompt}</Box>
    </Box>
  );
}
