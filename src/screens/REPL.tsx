import React, { useEffect, useMemo, useRef, useState } from "react";
import { APP_DEFINITIONS, getAppDefinition } from "../apps/catalog";
import { findCommand, getCommands, isKnownAppId, switchVariantMessage } from "../commands";
import { QueryEngine } from "../QueryEngine";
import { createMockMailboxItem, createMockNotification } from "../mocks/runtime";
import { useAppState, useAppStateStore, useSetAppState } from "../state/AppState";
import type { AppDefinition, AppPanel, MockTask, QueryEvent, TranscriptMessage } from "../types";
import { handlePromptSubmit } from "../utils/handlePromptSubmit";
import { makeMessage } from "../utils/messages";
import { getTools } from "../tools";
import { FullscreenLayout } from "../components/FullscreenLayout";
import { VirtualMessageList } from "../components/VirtualMessageList";
import { PromptInput } from "../components/PromptInput";
import { StatusFooter } from "../components/StatusFooter";
import { HelpPanel } from "../components/HelpPanel";
import { TaskPanel } from "../components/TaskPanel";
import { AppPicker } from "../components/AppPicker";
import { ScrollKeybindingHandler } from "../components/ScrollKeybindingHandler";
import { useTerminalSize } from "../hooks/useTerminalSize";
import { useMailboxBridge } from "../hooks/useMailboxBridge";
import { useTaskListWatcher } from "../hooks/useTaskListWatcher";

export function REPL(): React.ReactNode {
  const selectedAppId = useAppState(state => state.selectedAppId);
  const messages = useAppState(state => state.messages);
  const tasks = useAppState(state => state.tasks);
  const notifications = useAppState(state => state.notifications);
  const mailboxQueue = useAppState(state => state.mailboxQueue);
  const statusLine = useAppState(state => state.statusLine);
  const focusMode = useAppState(state => state.focusMode);
  const panel = useAppState(state => state.panel);
  const searchTerm = useAppState(state => state.searchTerm);
  const transcriptOffset = useAppState(state => state.transcriptOffset);
  const isLoading = useAppState(state => state.isLoading);
  const setAppState = useSetAppState();
  const store = useAppStateStore();
  const app = getAppDefinition(selectedAppId);
  const [inputValue, setInputValue] = useState("");
  const activeTaskIdRef = useRef<string | null>(null);

  const commands = useMemo(() => getCommands(app), [app]);
  const tools = useMemo(() => getTools(app), [app]);
  const queryEngine = useMemo(
    () => new QueryEngine(app, tools, () => createMockNotification(app)),
    [app, tools],
  );
  const terminal = useTerminalSize();
  const visibleCount = Math.max(8, terminal.rows - (panel === "none" ? 10 : 18));

  useEffect(() => {
    const timers = [
      setTimeout(() => {
        setAppState(prev => ({
          ...prev,
          mailboxQueue: [...prev.mailboxQueue, createMockMailboxItem(app)],
        }));
      }, 2500),
      setTimeout(() => {
        const notification = createMockNotification(app);
        if (!notification) {
          return;
        }
        setAppState(prev => ({
          ...prev,
          notifications: [...prev.notifications, notification],
          statusLine: `${app.title} received a background notification.`,
        }));
      }, 4500),
    ];

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [app, setAppState]);

  const submitQuery = async (prompt: string) => {
    const userMessage = makeMessage("user", "text", prompt, "Prompt");
    const assistantMessageId = { current: "" };

    setAppState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      statusLine: `Running mock query in ${app.title}...`,
      transcriptOffset: 0,
    }));

    for await (const event of queryEngine.submitPrompt(prompt, store.getState().messages)) {
      applyQueryEvent(event, assistantMessageId);
    }

    if (activeTaskIdRef.current) {
      const taskId = activeTaskIdRef.current;
      activeTaskIdRef.current = null;
      setAppState(prev => ({
        ...prev,
        tasks: prev.tasks.map(task =>
          task.id === taskId ? { ...task, status: "completed" } : task,
        ),
      }));
    }

    setAppState(prev => ({
      ...prev,
      isLoading: false,
      statusLine: `${app.title} is idle. Ready for the next prompt.`,
    }));
  };

  function applyQueryEvent(event: QueryEvent, assistantMessageId: { current: string }) {
    if (event.type === "status") {
      setAppState(prev => ({ ...prev, statusLine: event.status }));
      return;
    }

    if (event.type === "tool-call") {
      setAppState(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          makeMessage("tool", "tool-call", event.detail, event.toolName),
        ],
      }));
      return;
    }

    if (event.type === "tool-result") {
      setAppState(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          makeMessage("tool", "tool-result", event.result, event.toolName),
        ],
      }));
      return;
    }

    if (event.type === "assistant-start") {
      assistantMessageId.current = event.messageId;
      setAppState(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            id: event.messageId,
            role: "assistant",
            kind: "text",
            title: event.title,
            content: "",
            timestamp: new Date().toISOString(),
          },
        ],
      }));
      return;
    }

    if (event.type === "assistant-chunk") {
      setAppState(prev => ({
        ...prev,
        messages: prev.messages.map(message =>
          message.id === event.messageId
            ? { ...message, content: message.content + event.chunk }
            : message,
        ),
      }));
      return;
    }

    if (event.type === "notification") {
      setAppState(prev => ({
        ...prev,
        notifications: [...prev.notifications, event.notification],
      }));
      return;
    }
  }

  const onSubmit = async () => {
    const submission = handlePromptSubmit(inputValue);
    setInputValue("");

    if (!submission || isLoading) {
      return;
    }

    if (submission.kind === "command") {
      const { command, args } = findCommand(submission.input, commands);
      if (!command) {
        setAppState(prev => ({
          ...prev,
          messages: [
            ...prev.messages,
            makeMessage("system", "text", `Unknown command: ${submission.input}`, "Command error"),
          ],
        }));
        return;
      }

      const result = await command.execute({ app, args });
      if (result.kind === "message") {
        const nextState = store.getState();
        if (submission.input.startsWith("/clear")) {
          const reset = resetVariantState(app);
          setAppState({
            ...reset,
            notifications: nextState.notifications,
            messages: [...reset.messages, ...result.messages],
          });
        } else if (submission.input.startsWith("/mailbox")) {
          setAppState(prev => ({
            ...prev,
            messages: [...prev.messages, ...result.messages],
            mailboxQueue: [...prev.mailboxQueue, createMockMailboxItem(app)],
          }));
        } else if (submission.input.startsWith("/notify")) {
          const notification = createMockNotification(app);
          setAppState(prev => ({
            ...prev,
            messages: [...prev.messages, ...result.messages],
            notifications: notification ? [...prev.notifications, notification] : prev.notifications,
          }));
        } else {
          setAppState(prev => ({
            ...prev,
            messages: [...prev.messages, ...result.messages],
          }));
        }
        return;
      }

      if (result.kind === "panel") {
        setAppState(prev => ({
          ...prev,
          panel: prev.panel === result.panel ? "none" : result.panel,
        }));
        return;
      }

      if (result.kind === "search") {
        setAppState(prev => ({
          ...prev,
          searchTerm: result.term,
          panel: "none",
          focusMode: "transcript",
          transcriptOffset: 0,
        }));
        return;
      }

      if (result.kind === "clear-search") {
        setAppState(prev => ({
          ...prev,
          searchTerm: "",
        }));
        return;
      }

      if (result.kind === "switch-app") {
        if (!isKnownAppId(result.appId)) {
          setAppState(prev => ({
            ...prev,
            messages: [
              ...prev.messages,
              makeMessage("system", "text", `Unknown app variant: ${result.appId}`, "Variant switch"),
            ],
          }));
          return;
        }

        const reset = resetVariantState(getAppDefinition(result.appId));
        const confirmation = switchVariantMessage(result.appId);
        setAppState({
          ...reset,
          messages:
            confirmation.kind === "message"
              ? [...reset.messages, ...confirmation.messages]
              : reset.messages,
        });
      }

      return;
    }

    await submitQuery(submission.input);
  };

  useMailboxBridge({
    isLoading,
    mailboxQueue,
    onConsume: id =>
      setAppState(prev => ({
        ...prev,
        mailboxQueue: prev.mailboxQueue.filter(item => item.id !== id),
      })),
    onSubmitMessage: content => {
      void submitQuery(content);
    },
  });

  useTaskListWatcher({
    isLoading,
    tasks,
    onSubmitTask: (prompt, taskId) => {
      activeTaskIdRef.current = taskId;
      setAppState(prev => ({
        ...prev,
        tasks: prev.tasks.map(task =>
          task.id === taskId ? { ...task, status: "active" } : task,
        ),
      }));
      void submitQuery(prompt);
    },
  });

  const panelNode = renderPanel(panel, app, commands, tasks, selectedAppId, setAppState);

  return (
    <>
      <ScrollKeybindingHandler
        active={focusMode === "transcript"}
        onStep={delta =>
          setAppState(prev => ({
            ...prev,
            transcriptOffset: Math.max(0, prev.transcriptOffset + delta),
          }))
        }
        onJumpToTop={() =>
          setAppState(prev => ({
            ...prev,
            transcriptOffset: Math.max(0, prev.messages.length - 1),
          }))
        }
        onJumpToBottom={() =>
          setAppState(prev => ({
            ...prev,
            transcriptOffset: 0,
          }))
        }
        onToggleFocus={() =>
          setAppState(prev => ({
            ...prev,
            focusMode: prev.focusMode === "input" ? "transcript" : "input",
          }))
        }
      />
      <FullscreenLayout
        scrollable={
          <VirtualMessageList
            messages={messages}
            visibleCount={visibleCount}
            offsetFromBottom={transcriptOffset}
            searchTerm={searchTerm}
          />
        }
        panel={panelNode}
        footer={
          <StatusFooter
            app={app}
            focusMode={focusMode}
            statusLine={statusLine}
            notifications={notifications}
            tasksCount={tasks.filter(task => task.status !== "completed").length}
            searchTerm={searchTerm}
          />
        }
        prompt={
          <PromptInput
            active={focusMode === "input"}
            value={inputValue}
            loading={isLoading}
            onChange={setInputValue}
            onSubmit={() => void onSubmit()}
            onToggleFocus={() =>
              setAppState(prev => ({
                ...prev,
                focusMode: prev.focusMode === "input" ? "transcript" : "input",
              }))
            }
            onToggleTasks={() =>
              setAppState(prev => ({
                ...prev,
                panel: prev.panel === "tasks" ? "none" : "tasks",
              }))
            }
            onToggleHelp={() =>
              setAppState(prev => ({
                ...prev,
                panel: prev.panel === "help" ? "none" : "help",
              }))
            }
          />
        }
      />
    </>
  );
}

function renderPanel(
  panel: AppPanel,
  app: AppDefinition,
  commands: ReturnType<typeof getCommands>,
  tasks: MockTask[],
  selectedId: string,
  setAppState: ReturnType<typeof useSetAppState>,
): React.ReactNode {
  if (panel === "help") {
    return <HelpPanel app={app} commands={commands} />;
  }

  if (panel === "tasks") {
    return <TaskPanel tasks={tasks} />;
  }

  if (panel === "apps") {
    return (
      <AppPicker
        apps={APP_DEFINITIONS}
        selectedId={selectedId}
        title="Switch application shell"
        onSelect={appId => {
          const next = resetVariantState(getAppDefinition(appId));
          setAppState(next);
        }}
      />
    );
  }

  return null;
}

function resetVariantState(app: AppDefinition) {
  return {
    selectedAppId: app.id,
    messages: app.starterMessages.map(entry =>
      makeMessage(entry.role, entry.kind, entry.content, entry.title),
    ),
    tasks: app.tasks.map(task => ({
      id: `task-${Math.random().toString(36).slice(2, 8)}`,
      subject: task.subject,
      description: task.description,
      status: "pending" as const,
    })),
    notifications: app.notifications.length > 0
      ? [{
          id: `note-${Math.random().toString(36).slice(2, 8)}`,
          title: app.notifications[0]!.title,
          body: app.notifications[0]!.body,
          tone: app.notifications[0]!.tone,
        }]
      : [],
    mailboxQueue: [],
    statusLine: `Loaded ${app.title}. Mock services ready.`,
    focusMode: "input" as const,
    panel: "none" as const,
    searchTerm: "",
    transcriptOffset: 0,
    isLoading: false,
  };
}
