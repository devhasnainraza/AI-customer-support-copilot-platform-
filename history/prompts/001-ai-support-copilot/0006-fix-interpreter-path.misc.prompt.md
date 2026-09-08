---
id: "0006"
title: Fix Linter Interpreter Path
stage: misc
date: 2026-06-20
surface: agent
model: Gemini 3.5 Flash (Low)
feature: 001-ai-support-copilot
branch: 001-ai-support-copilot
user: Muhammad Hasnain
command: Explain what this problem is and help me fix it
labels: ["python-venv", "linter-setup", "import-error"]
links:
  spec: specs/001-ai-support-copilot/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - backend/src/utils/telemetry.py
tests: []
---

## Prompt

Explain what this problem is and help me fix it: Cannot find module `opentelemetry.exporter.prometheus`
...

## Response snapshot

Explained that the IDE/editor is using the global Python interpreter instead of the project's virtual environment, causing package import errors. Guided the user to configure the correct interpreter path.

## Outcome

- ✅ Impact: Assisted user in resolving IDE editor import errors.
- 🧪 Tests: None (configuration issue).
- 📁 Files: None.
- 🔁 Next prompts: None.
- 🧠 Reflection: IDE tool chains must be pointed to the active `venv` to resolve local package imports correctly.

## Evaluation notes (flywheel)

- Failure modes observed: None
- Graders run and results (PASS/FAIL): None
- Prompt variant (if applicable): None
- Next experiment (smallest change to try): None
