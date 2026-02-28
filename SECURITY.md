# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in indieFilmer, please report it responsibly.
**Do not open a public GitHub issue for security-related bugs.**

Instead, use one of the following methods:

- **Email:** [security@indiefilmer.com](mailto:security@indiefilmer.com)
- **GitHub:** Open a [private security advisory](https://github.com/indiefilmer/indiefilmer/security/advisories/new)

Please include as much detail as possible: steps to reproduce, affected versions,
and the potential impact. If you have a proposed fix, feel free to include a patch.

## Response Timeline

| Step                  | Target          |
|-----------------------|-----------------|
| Acknowledgement       | Within 48 hours |
| Initial assessment    | Within 7 days   |
| Fix for critical issues | Within 30 days  |

We will keep you informed of our progress throughout the process. If we determine
the report is valid, we will credit you in the release notes (unless you prefer
to remain anonymous).

## Supported Versions

Only the **latest release** of indieFilmer receives security updates. We do not
back-port fixes to older versions. We recommend always running the most recent
release.

| Version        | Supported |
|----------------|-----------|
| Latest release | Yes       |
| Older releases | No        |

## Scope

### In scope

- The indieFilmer application source code (this repository)
- Authentication and session management logic
- Server actions, API routes, and middleware
- File upload validation
- Tenant/project isolation logic

### Out of scope

- Third-party dependencies (report these to the upstream project)
- Infrastructure, hosting, or network configuration of self-hosted deployments
- Issues that require physical access to the server
- Social engineering attacks against users or maintainers
- Denial-of-service attacks against self-hosted instances

## Security Model

indieFilmer is a Next.js application designed for small-team film production
planning. It supports two deployment modes: a public VPS mode with email-based
authentication and a self-hosted mode with password-based authentication.

Key security controls include:

- **Session-based authentication** -- HTTP-only, secure, SameSite cookies with
  server-side session validation on every request via middleware.
- **Middleware-enforced access control** -- All non-public routes require a valid
  session. Admin routes require a `superadmin` site role. Section-level access is
  checked per project membership.
- **Rate limiting** -- In-memory sliding-window rate limiter protects
  authentication and sensitive API endpoints against brute-force attacks.
- **File upload validation** -- Uploads are validated by extension, MIME type
  cross-check, and file size limits per upload category.
- **Tenant isolation** -- All data queries are scoped to the active project
  (`projectId`). Project membership is enforced at the middleware and action layers.
- **Audit logging** -- Mutations record the acting user via `performedBy` for
  traceability. Destructive operations use soft-delete where applicable.

## License

This project is licensed under the [MIT License](LICENSE). The security policy
does not alter the terms of that license. The software is provided "as is"
without warranty of any kind.
