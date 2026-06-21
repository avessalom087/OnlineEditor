# Project-Scoped AI Instructions & Token Optimization Rules

To optimize token usage, response speed, and ensure safe code changes:

## 1. Code Editing & Diffing Constraints
- **Targeted Replacements**: Always use the narrowest possible replacement chunks with `replace_file_content` or `multi_replace_file_content`. Never rewrite entire files or large contiguous blocks if only a few lines are changing.
- **Do Not Duplicate Code in Chat**: Do not output large code blocks or full file contents in the chat responses. Rely on file links (e.g. `[filename](file:///path/to/file)`) and let the user view changes directly in their editor or via diffs.
- **Preserve Unrelated Content**: Keep existing code, docstrings, imports, and comments untouched unless they are directly part of the requested change.

## 2. Concise Communication
- **No Greetings or Conversational Padding**: Start responses directly with actions or outcomes. Omit generic greetings like "Hello", "Sure, I can help with that", or concluding conversational wrap-ups.
- **Refer to Artifacts Directly**: Do not summarize the contents of newly created or updated artifacts (such as plans or walkthroughs) in the chat window. Point the user to the file link and mention only decisions requiring direct feedback.

## 3. Directory & File Operations
- **Respect Whitelists**: Follow the folder whitelists (`expansion`, `expansionmod`, `mpg_spawner`, `searchforloot`) and skip backups or compiler output directories.
- **No Redundant Commands**: Do not run multiple command tasks or diagnostic loops when verifying builds. One build test is sufficient.
