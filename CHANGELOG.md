# chat-app

## 2.0.2

### Patch Changes

- e3ad385: The system has been fully implemented to support multi-step execution with strict safety and hallucination prevention.d it can self-heal a failed tool execution by asking the LLM for a corrected decision before falling back to normal retry behavior. The planner now preserves step input/output from LLM plans and explicitly asks for template-ready step context

## 2.0.1

### Patch Changes

- 67ff3ac: Publish dedicated chat-socket image with legacy compatibility aliases and add otp stepup-up flow in stepup challenge

## 2.0.0

### Major Changes

- 8a4de46: Added task management across the stack, including shared task models/types, task APIs and socket events, a real-time task panel in the web app, and an outbox-driven worker for task intelligence and execution.

### Patch Changes

- Bump root package version to publish release metadata.
