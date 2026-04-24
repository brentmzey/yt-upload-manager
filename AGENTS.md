# Agent Guidelines & Engineering Standards

## Core Mandates
- **Security First**: Always use secure code. Prevent XSS, memory leaks, injection points, and weak API setups. Ensure proper headers and protections are in place.
- **Credential Protection**: NEVER expose secrets, API keys, or sensitive credentials in logs, code, or commits. Use environment variables and secure configuration.
- **Strong Typings**: Use strict TypeScript. Avoid `any`. Define clear interfaces and types for all data.
- **Functional Programming Style**:
  - Prefer immutability.
  - Use monadic patterns where appropriate (e.g., `Option`, `Result`, `Either`).
  - Utilize `map`, `flatMap` (or `chain`), and functional composition.
  - Handle side effects explicitly (e.g., using `Async` or `IO` patterns).
- **Error Handling & Logging**:
  - Implement robust error handling.
  - Use structured logging via the `LoggerService` (wrapping `tauri-plugin-log`).
  - Log errors with sufficient context (monadic `logError`) but without sensitive data.
  - Ensure logs are piped to the Tauri backend for persistence.
- **12-Factor App Design**:
  - Config: Store configuration in the environment or dynamic backing services (PocketBase).
  - Backing Services: Treat backing services as attached resources.
  - Statelessness: Keep the application logic as stateless as possible.

## Post-Implementation Checklist
Before concluding any task, scan for:
- [ ] Vulnerabilities (XSS, Injection, etc.)
- [ ] Memory leaks
- [ ] Exposed secrets
- [ ] Non-best practices
- [ ] Weak API call setups
- [ ] Poor headers or missing protections
- [ ] Proper error handling and logging
