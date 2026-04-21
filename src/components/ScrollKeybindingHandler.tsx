import React from "react";
import { useInput } from "../ink";
import type { InkKey } from "../ink";

export function ScrollKeybindingHandler(props: {
  active: boolean;
  onStep: (delta: number) => void;
  onJumpToTop: () => void;
  onJumpToBottom: () => void;
  onToggleFocus: () => void;
}): null {
  const { active, onStep, onJumpToTop, onJumpToBottom, onToggleFocus } = props;

  useInput((input: string, key: InkKey) => {
    if (!active) {
      return;
    }

    if (key.tab) {
      onToggleFocus();
      return;
    }

    if (key.upArrow || input === "k") {
      onStep(1);
      return;
    }

    if (key.downArrow || input === "j") {
      onStep(-1);
      return;
    }

    if (input === "g") {
      onJumpToTop();
      return;
    }

    if (input === "G") {
      onJumpToBottom();
    }
  });

  return null;
}
