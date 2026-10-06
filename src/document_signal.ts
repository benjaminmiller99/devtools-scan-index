export type DocumentSignal =
  | "build_event"
  | "release_operation"
  | "developer_diagnostic";

const releaseTerms = /\b(deploy(?:ed|ment)?|release|rollback|version)\b/i;
const diagnosticTerms = /\b(error|exception|failed|stack trace|diagnostic)\b/i;

export function classifyDocument(text: string): DocumentSignal {
  if (diagnosticTerms.test(text)) return "developer_diagnostic";
  if (releaseTerms.test(text)) return "release_operation";
  return "build_event";
}
