"""Email verification providers.

`BuiltinEmailVerifier` performs real syntax, disposable-domain and DNS/MX
checks with no external service.
"""

import re
from dataclasses import dataclass

EMAIL_SYNTAX_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

DISPOSABLE_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
    "throwawaymail.com", "yopmail.com", "sharklasers.com", "getnada.com",
}

ROLE_PREFIXES = ("info", "hello", "contact", "office", "admin", "support", "sales", "enquiries", "noreply")


@dataclass
class VerifyResult:
    # valid | risky | invalid
    status: str
    detail: str


class EmailVerifier:
    name = "verify"

    def verify(self, email: str) -> VerifyResult:
        raise NotImplementedError


def _syntax_and_disposable(email: str) -> VerifyResult | None:
    """Shared pre-checks; returns a terminal result or None to continue."""
    email = email.strip().lower()
    if not EMAIL_SYNTAX_RE.match(email):
        return VerifyResult("invalid", "Address fails basic syntax checks.")
    domain = email.split("@", 1)[1]
    if domain in DISPOSABLE_DOMAINS:
        return VerifyResult("invalid", f"{domain} is a disposable email domain.")
    return None


class BuiltinEmailVerifier(EmailVerifier):
    name = "Built-in Verifier (syntax + MX)"

    def verify(self, email: str) -> VerifyResult:
        pre = _syntax_and_disposable(email)
        if pre:
            return pre
        email = email.strip().lower()
        local, domain = email.split("@", 1)

        try:
            import dns.resolver

            answers = dns.resolver.resolve(domain, "MX", lifetime=8)
            has_mx = len(list(answers)) > 0
        except Exception as exc:  # NXDOMAIN, timeout, no answer…
            exc_name = type(exc).__name__
            if exc_name in ("NXDOMAIN", "NoAnswer"):
                return VerifyResult("invalid", f"No mail server (MX) records found for {domain}.")
            return VerifyResult("risky", f"MX lookup for {domain} failed ({exc_name}); deliverability unconfirmed.")

        if not has_mx:
            return VerifyResult("invalid", f"No mail server (MX) records found for {domain}.")
        if local in ROLE_PREFIXES:
            return VerifyResult("risky", f"Mail server found, but {local}@ is a role address — expect lower reply rates.")
        return VerifyResult("valid", f"Syntax OK and mail server (MX) confirmed for {domain}.")
