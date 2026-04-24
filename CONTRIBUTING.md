# Contributing to YT Upload Manager

We welcome contributions! To maintain the high architectural standards of this project, please follow these guidelines.

## 🏗 Architectural Principles
1. **Functional First**: Use `Effect` for all side effects and error handling. Avoid `try/catch` in library code; use `Effect.tryPromise` or `Effect.gen`.
2. **Type Safety**: Ensure end-to-end type safety. If you add a new data structure in the Rust backend, use `ts-rs` to export it to TypeScript.
3. **12-Factor Design**: Never hardcode configuration. Use environment variables or backing services (PocketBase).
4. **Surgical Edits**: Keep changes focused. Avoid unrelated refactoring.

## 🛠 Development Workflow
1. **Branching**: Create a feature branch from `main`.
2. **Type Checking**: Run `bunx tsc --noEmit` before committing.
3. **Rust Verification**: Run `cd src-tauri && cargo check` to verify backend changes.
4. **Binding Generation**: If you modify Rust structs marked with `#[derive(TS)]`, run `cd src-tauri && cargo test` to update the TypeScript bindings.

## 🔒 Security
- Do not log sensitive data.
- Ensure all new API endpoints or Tauri commands are covered by the Content Security Policy (CSP).
- Scan for XSS when rendering dynamic metadata.

## 📝 Commits
Use descriptive, concise commit messages. Prefer "Why" over "What".
Example: `feat: add retry logic for failed batch uploads`
