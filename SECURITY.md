# Security Policy

## Supported Versions

We only provide security updates for the latest version of the application.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please report it immediately by opening a private issue or contacting the maintainer directly.

We take all security reports seriously and will work to resolve identified issues as quickly as possible.

## Automated Scanning

This project uses the following automated security scanning tools in its CI/CD pipeline:

- **cargo-audit**: Scans Rust dependencies for known CVEs.
- **bun pm scan**: Audits JavaScript dependencies for security vulnerabilities.
- **Manual Code Review**: We regularly review the codebase for common vulnerabilities like XSS, Injection, and Insecure Defaults.
