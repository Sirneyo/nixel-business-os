"""Email sending providers.

`SmtpEmailSender` works with any SMTP provider (AWS SES, Postmark, Mailgun,
Google Workspace, …) using credentials from environment variables.
`DemoEmailSender` records sends without contacting anything, so campaigns and
automations can be explored safely.
"""

import smtplib
from dataclasses import dataclass
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


@dataclass
class SendResult:
    # simulated | sent | failed
    status: str
    detail: str = ""


class EmailSender:
    name = "sender"
    is_real = False

    def send(self, *, to_email: str, subject: str, html: str, text: str) -> SendResult:
        raise NotImplementedError


class DemoEmailSender(EmailSender):
    name = "Demo Sender (no emails leave the system)"
    is_real = False

    def send(self, *, to_email: str, subject: str, html: str, text: str) -> SendResult:
        return SendResult("simulated", f"Demo mode: email to {to_email} recorded but not sent.")


class SmtpEmailSender(EmailSender):
    name = "SMTP Sender"
    is_real = True

    def __init__(self, *, host: str, port: int, username: str, password: str, from_email: str, from_name: str):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.from_email = from_email
        self.from_name = from_name

    def send(self, *, to_email: str, subject: str, html: str, text: str) -> SendResult:
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{self.from_name} <{self.from_email}>" if self.from_name else self.from_email
        message["To"] = to_email
        message.attach(MIMEText(text, "plain", "utf-8"))
        message.attach(MIMEText(html, "html", "utf-8"))
        try:
            with smtplib.SMTP(self.host, self.port, timeout=30) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                if self.username:
                    server.login(self.username, self.password)
                server.sendmail(self.from_email, [to_email], message.as_string())
            return SendResult("sent", f"Delivered to SMTP relay {self.host}.")
        except Exception as exc:
            return SendResult("failed", f"{type(exc).__name__}: {exc}")
