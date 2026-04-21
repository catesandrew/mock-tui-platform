import { useEffect } from "react";
import type { MockMailboxItem } from "../types";

type Props = {
  isLoading: boolean;
  mailboxQueue: MockMailboxItem[];
  onSubmitMessage: (content: string) => void;
  onConsume: (id: string) => void;
};

export function useMailboxBridge(props: Props): void {
  const { isLoading, mailboxQueue, onSubmitMessage, onConsume } = props;

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const next = mailboxQueue[0];
    if (!next) {
      return;
    }

    onConsume(next.id);
    onSubmitMessage(next.content);
  }, [isLoading, mailboxQueue, onConsume, onSubmitMessage]);
}
