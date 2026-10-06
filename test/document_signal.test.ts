import assert from "node:assert/strict";
import test from "node:test";
import { classifyDocument } from "../src/document_signal.js";

test("diagnostics outrank release language in an incident document", () => {
  const scannedText = "Release 2026.09.13 failed with an exception during asset upload.";
  assert.equal(classifyDocument(scannedText), "developer_diagnostic");
});

test("a deployment record is modeled as a release operation", () => {
  assert.equal(classifyDocument("Version 4.8 deployed to the web tier."), "release_operation");
});
