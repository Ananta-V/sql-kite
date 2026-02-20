# Security Policy

## Supported Versions

We actively maintain the latest version of SQL-Kite.
Security updates and fixes are applied only to the most recent release.

Older versions may contain known vulnerabilities and are not guaranteed to receive patches.

| Version        | Supported |
| -------------- | --------- |
| Latest         | Yes       |
| Older releases | No        |

---

## Reporting a Vulnerability

If you discover a security vulnerability in SQL-Kite, **do not open a public GitHub Issue**.

Public disclosure before a fix is available can put users at risk.

Instead, please report it privately:

**Email:** [anantavidya110@gmail.com](mailto:anantavidya110@gmail.com)

Please include as much detail as possible:

* Description of the vulnerability
* Steps to reproduce
* Proof of concept (if available)
* Affected components or files
* Potential impact
* Suggested fix (optional)

You do **not** need to be 100% certain — if you suspect a security issue, report it.

---

## What to Expect

After you report a vulnerability:

1. You will receive an acknowledgment within 48 hours
2. We will investigate and validate the issue
3. A fix will be developed and tested
4. A security patch will be released
5. We may credit you in the release notes (optional)

We will keep communication private until a fix is available.

---

## Responsible Disclosure

We follow a responsible disclosure process:

* The vulnerability remains confidential while a fix is prepared
* We request reporters to avoid public disclosure until patched
* Once fixed, we will publish a security notice and changelog

This protects both users and the project.

---

## Scope

The security policy applies to:

* The SQL-Kite source code
* Official releases
* Installation scripts
* Documentation that affects configuration or permissions

Third-party dependencies are maintained separately by their own maintainers, but reports are still welcome if SQL-Kite usage exposes risk.

---

## Out of Scope

The following are generally not considered security vulnerabilities:

* Typos or documentation mistakes
* Theoretical vulnerabilities without proof of exploit
* Issues in third-party libraries not controlled by SQL-Kite
* Social engineering or phishing attempts unrelated to the project
* Denial of service caused by extremely unrealistic usage

---

## Security Best Practices for Users

We recommend users:

* Keep SQL-Kite updated to the latest version
* Do not expose database credentials publicly
* Use environment variables for secrets
* Apply database least-privilege access
* Avoid running SQL-Kite with administrator/root permissions unless required

---

## Thank You

We appreciate responsible disclosure and the effort taken to help make SQL-Kite safer for everyone.
