import { getAppDefinition } from "../apps/catalog";
import type { AppDefinition, AppState, MockNotification, MockTask, TranscriptMessage } from "../types";
import { makeMessage } from "../utils/messages";
import { createId } from "../utils/id";

function buildStarterMessages(app: AppDefinition): TranscriptMessage[] {
  return app.starterMessages.map(entry =>
    makeMessage(entry.role, entry.kind, entry.content, entry.title),
  );
}

function buildStarterTasks(app: AppDefinition): MockTask[] {
  return app.tasks.map(task => ({
    id: createId("task"),
    subject: task.subject,
    description: task.description,
    status: "pending",
  }));
}

function buildStarterNotifications(app: AppDefinition): MockNotification[] {
  return app.notifications.map(item => ({
    id: createId("note"),
    title: item.title,
    body: item.body,
    tone: item.tone,
  }));
}

export function getDefaultAppState(appId: string): AppState {
  const app = getAppDefinition(appId);
  return {
    selectedAppId: app.id,
    messages: buildStarterMessages(app),
    tasks: buildStarterTasks(app),
    notifications: buildStarterNotifications(app).slice(0, 1),
    mailboxQueue: [],
    statusLine: `Loaded ${app.title}. Mock services ready.`,
    focusMode: "input",
    panel: "none",
    searchTerm: "",
    transcriptOffset: 0,
    isLoading: false,
  };
}
