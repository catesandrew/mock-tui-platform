import type { TranscriptMessage } from "../types";
import { createId } from "./id";
import { isoNow } from "./time";

export function makeMessage(
  role: TranscriptMessage["role"],
  kind: TranscriptMessage["kind"],
  content: string,
  title?: string,
): TranscriptMessage {
  return {
    id: createId("msg"),
    role,
    kind,
    title,
    content,
    timestamp: isoNow(),
  };
}
