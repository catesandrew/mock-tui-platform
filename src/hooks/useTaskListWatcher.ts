import { useEffect } from "react";
import type { MockTask } from "../types";

type Props = {
  isLoading: boolean;
  tasks: MockTask[];
  onSubmitTask: (prompt: string, taskId: string) => void;
};

export function useTaskListWatcher(props: Props): void {
  const { isLoading, tasks, onSubmitTask } = props;

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const nextTask = tasks.find(task => task.status === "pending");
    if (!nextTask) {
      return;
    }

    onSubmitTask(
      `Task prompt: ${nextTask.subject}. ${nextTask.description}`,
      nextTask.id,
    );
  }, [isLoading, tasks, onSubmitTask]);
}
