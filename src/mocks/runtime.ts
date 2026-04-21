import type { AppDefinition, MockMailboxItem, MockNotification } from "../types";
import { createId } from "../utils/id";

export function createMockMailboxItem(app: AppDefinition): MockMailboxItem {
  return {
    id: createId("mail"),
    content: app.mailboxPrompts[0] ?? `Mailbox prompt for ${app.title}`,
  };
}

export function createMockNotification(app: AppDefinition): MockNotification | undefined {
  const seed = app.notifications[1] ?? app.notifications[0];
  if (!seed) {
    return undefined;
  }

  return {
    id: createId("note"),
    title: seed.title,
    body: seed.body,
    tone: seed.tone,
  };
}
