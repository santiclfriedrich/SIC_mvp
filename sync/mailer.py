# -*- coding: utf-8 -*-
"""Envío de correos por SMTP (Gmail con "Contraseña de aplicación").

Lo usa la sección de Transferencias para mandar por mail los movimientos
Jura↔TML, como se hacía a mano. Las credenciales viven en `config`
(leídas de .env / variables de entorno). Si el SMTP no está configurado,
`send_html` levanta MailNotConfigured para que la UI avise sin romper.
"""
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

import config


class MailNotConfigured(Exception):
    """Faltan SMTP_USER / SMTP_PASS: el envío está desactivado."""


def enabled():
    return bool(config.SMTP_USER and config.SMTP_PASS)


def send_html(to, subject, html, cc=None, text=None):
    """Manda un mail HTML. `to` y `cc` son listas de direcciones.
    Devuelve {"to": [...], "cc": [...]} con lo efectivamente enviado."""
    if not enabled():
        raise MailNotConfigured("SMTP_USER/SMTP_PASS no configurados")
    to = [a for a in (to or []) if a]
    cc = [a for a in (cc or []) if a]
    if not to and not cc:
        raise ValueError("sin destinatarios")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((config.MAIL_FROM_NAME, config.MAIL_FROM))
    msg["To"] = ", ".join(to)
    if cc:
        msg["Cc"] = ", ".join(cc)
    msg.set_content(text or "Este mensaje se ve mejor en un cliente con HTML.")
    msg.add_alternative(html, subtype="html")

    ctx = ssl.create_default_context()
    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=20) as s:
        s.ehlo()
        s.starttls(context=ctx)
        s.login(config.SMTP_USER, config.SMTP_PASS)
        s.send_message(msg)
    return {"to": to, "cc": cc}
