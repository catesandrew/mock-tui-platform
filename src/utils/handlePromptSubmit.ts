export type PromptSubmission =
  | { kind: "command"; input: string }
  | { kind: "query"; input: string };

export function handlePromptSubmit(input: string): PromptSubmission | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return { kind: "command", input: trimmed };
  }

  return { kind: "query", input: trimmed };
}
