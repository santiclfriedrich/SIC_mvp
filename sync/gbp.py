# -*- coding: utf-8 -*-
"""Cliente SOAP para los Web Services de GlobalBluePoint (GBP).

Solo operaciones de LECTURA (wsBasicQuery). Cada thread mantiene su propio
cliente + token (válido 60 minutos).
"""
import threading
import time

import requests
import urllib3
from lxml import etree
from zeep import Client, Settings
from zeep.transports import Transport

import config

urllib3.disable_warnings()

_local = threading.local()

# El server de GBP a veces devuelve 403 al pedir el WSDL (WAF / rate-limit
# momentáneo desde la IP). Reintentamos con backoff antes de rendirnos, así
# el hipo se resuelve dentro de la misma corrida y no tumba el sync.
_CONNECT_RETRIES = 3
_CONNECT_BACKOFF = 5  # segundos (crece por intento: 5, 10)

# Un user-agent "de navegador": el default de requests (python-requests/x)
# es lo que suelen bloquear los WAF con un 403.
_USER_AGENT = "Mozilla/5.0 (compatible; bi-stock/1.0; +https://bi-stock.vercel.app)"


def _authenticate():
    session = requests.Session()
    session.verify = False  # el server usa un certificado propio
    session.headers.update({"User-Agent": _USER_AGENT})
    client = Client(
        wsdl=config.GBP_URL + "?WSDL",
        transport=Transport(session=session, timeout=600),
        settings=Settings(strict=False, xml_huge_tree=True),
    )
    Header = client.get_type("ns0:wsBasicQueryHeader")
    header = Header(
        pUsername=config.GBP_USER,
        pPassword=config.GBP_PASSWORD,
        pCompany=config.GBP_COMPANY,
        pWebWervice=config.GBP_WEBSERVICE,
    )
    token = client.service.AuthenticateUser(
        _soapheaders={"wsBasicQueryHeader": header}
    )
    if not token or "WARNING" in str(token) or "not available" in str(token):
        raise RuntimeError("Autenticación GBP falló: %r" % token)
    header.pAuthenticatedToken = token
    return client, header


def _connect():
    """Autentica reintentando ante fallas transitorias (403/timeout/conexión)."""
    last = None
    for attempt in range(1, _CONNECT_RETRIES + 1):
        try:
            return _authenticate()
        except Exception as e:  # noqa: BLE001 - reintentar cualquier falla de conexión
            last = e
            print(f"[gbp] conexión intento {attempt}/{_CONNECT_RETRIES} "
                  f"falló: {e}", flush=True)
            if attempt < _CONNECT_RETRIES:
                time.sleep(_CONNECT_BACKOFF * attempt)
    raise last


def _service():
    if not hasattr(_local, "client"):
        _local.client, _local.header = _connect()
    return _local.client.service, {"wsBasicQueryHeader": _local.header}


def reset_connection():
    """Descarta el cliente del thread actual (fuerza re-autenticación)."""
    if hasattr(_local, "client"):
        del _local.client
        del _local.header


def _rows(result):
    # El resultado puede ser un string XML (la mayoría de los métodos) o un
    # Dataset de .NET que zeep entrega como elemento lxml (GBPScripts).
    if hasattr(result, "_value_1"):
        result = result._value_1
    if isinstance(result, list) and result:
        result = result[0]
    if isinstance(result, etree._Element):
        root = result
    else:
        # el XML de GBP puede traer caracteres de control -> parser tolerante
        root = etree.fromstring(
            str(result).encode("utf-8"),
            etree.XMLParser(recover=True, huge_tree=True),
        )
    if root is None:
        return []
    rows = root.findall(".//Table")
    if not rows:
        # los Dataset de GBPScripts pueden nombrar la fila distinto (Table1…)
        rows = [el for el in root.iter()
                if el.tag and str(el.tag).startswith("Table")]
    return [
        {etree.QName(c).localname: (c.text or "").strip() for c in row}
        for row in rows
    ]


def fetch(method, **params):
    """Llama a una operación de lectura y devuelve las filas como dicts."""
    service, hdr = _service()
    try:
        result = getattr(service, method)(_soapheaders=hdr, **params)
    except Exception:
        # token vencido o conexión caída: reintentar una vez con sesión nueva
        reset_connection()
        service, hdr = _service()
        result = getattr(service, method)(_soapheaders=hdr, **params)
    return _rows(result)
