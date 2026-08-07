# -*- coding: utf-8 -*-
"""Configuración del panel de stock — conexión a GlobalBluePoint (GBP).

Las credenciales NO van hardcodeadas: se leen de variables de entorno.
- Local: poné un archivo .env en la raíz (está gitignoreado). Ver .env.example.
- Producción: variables de entorno en Vercel.
- GitHub Actions: secrets del repo (ver .github/workflows/sync.yml).
"""
import os


def _load_dotenv():
    """Carga un .env local (si existe) sin pisar variables ya definidas.
    Simple a propósito: KEY=VALUE por línea, ignora comentarios."""
    path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(),
                                  val.strip().strip('"').strip("'"))


_load_dotenv()

# Web Service GBP (ver doc "Acceso Web Services GBP.docx")
GBP_URL = os.environ.get(
    "GBP_URL",
    "https://ws.globalbluepoint.com.ar/arg/app_webservices/wsBasicQuery.asmx",
)
GBP_USER = os.environ.get("GBP_USER", "")
GBP_PASSWORD = os.environ.get("GBP_PASSWORD", "")
GBP_COMPANY = int(os.environ.get("GBP_COMPANY", "1"))       # ARG COLOR S.R.L.
GBP_WEBSERVICE = int(os.environ.get("GBP_WEBSERVICE", "1011"))  # USER_TEST

# Listas de precios a sincronizar (prli_id). La 9 es "06-Lista Madre U$D".
SYNC_PRICE_LISTS = [1, 9]
DEFAULT_PRICE_LIST = 9   # lista de referencia (la usa el fetch de costos)

# Valorización por defecto del panel: 0 = costo (01-Lista de Costos);
# cualquier otro valor = prli_id de una lista de SYNC_PRICE_LISTS.
DEFAULT_VALUATION = 0

# Lista de costos del ERP ("01-Lista de Costos"). El costo se obtiene por
# artículo vía MercadoLibre_PriceListItems_funGetXMLDataV2 (viene en ARS,
# ya convertido con la cotización del ERP). Solo se consulta para los
# artículos con stock (el fetch masivo no lo soporta el servidor).
COST_LIST_ID = 1
COST_FETCH_WORKERS = 6

# Categorías que NO son mercadería (conceptos contables del ERP: fletes,
# ajustes, redondeos, servicios, IIBB...). Se excluyen de todo el panel.
EXCLUDED_CATEGORIES = [1, 60]  # 1=Uso Interno, 60=Servicio

# GBPScripts (módulo 73): etiquetas de los scripts creados en
# Configuración → Servicios WEB → GlobalBluePoint Scripts. Si existen, el
# sync trae TODOS los costos en una sola llamada (incluidos los artículos no
# habilitados para web/ML) y los nombres reales de los depósitos.
# SQL sugerido en el README. None = usar solo el método por artículo.
GBPSCRIPT_COSTS_LABEL = "BI.Costos"
GBPSCRIPT_STORAGES_LABEL = "BI.Depositos"
# Catálogo completo de artículos (tbItem). Item_funGetXMLData filtra ~la
# mitad; este script trae TODOS los activos. SQL sugerido en el README.
GBPSCRIPT_ITEMS_LABEL = "BI.Articulos"
# Stock físico/disponible por depósito (tbItemStorage). ItemStorage del WS
# también filtra artículos "no web"; este script trae todo. SQL en README.
GBPSCRIPT_STOCK_LABEL = "BI.Stock"

# Alternativa vieja: Consulta Personalizada sin parámetros (wsExportDataById).
EXPORT_COSTS_QUERY_ID = None

# --- Diferencias de stock TML: GBP vs SGL (sistema del depósito TML) ---
# Depósito de GBP contra el que se compara el stock de SGL.
SGL_COMPARE_STORAGE = 19  # TML
# API de SGL (⚠ solo se usa GetStock; NUNCA GetDocumentos/InsertDocumentos).
SGL_API_URL = os.environ.get(
    "SGL_API_URL", "https://conexion.tmlogistica.com.ar/SGLAPIS_TML_PROD")
SGL_CLIENT_ID = os.environ.get("SGL_CLIENT_ID", "argcol")
SGL_CLIENT_SECRET = os.environ.get("SGL_CLIENT_SECRET", "")
SGL_CLIENTE = int(os.environ.get("SGL_CLIENTE", "54"))  # nro de cliente en SGL

# "SKUs" de SGL que no son mercadería (ubicaciones/etiquetas logísticas):
# se descartan al traer el stock. Prefijos y códigos exactos (normalizados
# a mayúsculas). Ampliar si aparecen nuevos.
SGL_EXCLUDE_PREFIXES = ["PALLET", "XEROXALTPALL", "DEVOLUC"]
SGL_EXCLUDE_SKUS = ["PO", "NTB1", "PISTOLA TERMOMETRO"]

# Combos/kits: en GBP son UN artículo, pero en SGL se guardan como sus
# componentes por separado (por part number). Para comparar sin falsos
# desvíos, el stock SGL del combo = mín(componentes) sets completos, y los
# componentes consumidos se descuentan. Clave = código GBP del combo;
# valor = lista de SKUs de los componentes en SGL.  Ampliar cuando aparezcan.
SGL_COMBOS = {
    "IMPHPC1724": ["3PZ75A", "D9P29A", "W9024MC"],
}

# --- Ventas: clasificación de canal por condición de venta ---
# B2C = tiendas web + MercadoLibre + FullJaus; el resto es B2B.
VENTAS_B2C_CONDICIONES = ["MercadoPago ML", "Mercado Pago + Boton en FC",
                          "Venta FullJaus"]
VENTAS_B2C_PREFIJOS = ["Tienda "]   # Tienda Fravega, OnCity, ICBC, BNA, etc.

# Nombres de depósitos (el WS solo devuelve el ID; mapeo confirmado con el
# reporte 21 del ERP). Los que falten se muestran como "Depósito N".
# (el 17 sin alias: usa el nombre real del ERP "05-Deposito Arg. Color FULL")
STORAGE_NAMES = {
    1: "Juramento",
    19: "TML",
    25: "Test TML",
}

# Depósitos que muestra el panel, EN ORDEN DE VISUALIZACIÓN:
# Juramento, TML (después va la fila "TML según SGL"), Arg Color FULL,
# SKOP FULL, KANJI FULL. ⚠ Nunca agregar el 21 ni el 24: son totalizadores
# (suman otros depósitos) y duplicarían el stock.
VISIBLE_STORAGES = [1, 19, 17, 31, 30]

# Cotización USD->ARS de respaldo hasta que el ERP la informe por WS
# (editable desde la UI; el valor real vive en la tabla meta).
DEFAULT_COTIZACION = 1510.0

# Base de datos: Supabase (Postgres) es la base única del panel — la
# alimenta GitHub Actions cada 2 horas. Para forzar el SQLite local
# (ej. pruebas sin tocar la nube) correr con DATABASE_URL="" vacía.
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
DB_PATH = os.path.join(os.path.dirname(__file__), "data", "stock.db")

# Cantidad de descargas de stock en paralelo (una por depósito visible)
SYNC_WORKERS = len(VISIBLE_STORAGES)

# Sincronización automática cada N minutos (0 = desactivada). El botón
# manual sigue funcionando igual; si hay una corriendo, se saltea el turno.
SYNC_INTERVAL_MINUTES = 60

# Usuarios del panel (login web). Cambiar las claves antes de compartir el
# link. Con el diccionario vacío ({}) el login se desactiva (solo uso local).
# En la nube se puede definir por env: PANEL_USERS='{"usuario":"clave"}'
import json as _json
PANEL_USERS = (_json.loads(os.environ["PANEL_USERS"])
               if os.environ.get("PANEL_USERS") else {})

# Disparo del sync en la nube (GitHub Actions). Con GITHUB_TOKEN y
# GITHUB_REPO definidos, el botón "Sincronizar" dispara el workflow.
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN") or None
GITHUB_REPO = os.environ.get("GITHUB_REPO") or None      # ej: "argcolor/bi-stock"
GITHUB_WORKFLOW = os.environ.get("GITHUB_WORKFLOW", "sync.yml")
# Workflow liviano que recalcula solo los negativos (lo dispara el botón
# "Actualizar" de Compras). Ver .github/workflows/negativos.yml.
GITHUB_WORKFLOW_NEGATIVOS = os.environ.get("GITHUB_WORKFLOW_NEGATIVOS",
                                           "negativos.yml")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")

# Disparador externo confiable (cron-job.org): el endpoint /api/cron/<qué>
# dispara el sync solo si recibe esta clave secreta (header X-Cron-Key o
# ?key=). Vacío => el endpoint queda deshabilitado. Va en env (Vercel) y en
# cron-job.org; nunca en el repo. GitHub cron queda solo de respaldo.
CRON_KEY = os.environ.get("CRON_KEY", "")

# --- Envío de correos (transferencias Jura↔TML) ---
# SMTP de Gmail con "Contraseña de aplicación": un código de 16 letras que se
# genera en la cuenta de Google (Seguridad → Verificación en 2 pasos →
# Contraseñas de aplicación), DISTINTO de la clave real. Va en .env como
# SMTP_USER (tu casilla @argentinacolor.com) y SMTP_PASS (esas 16 letras).
# Con SMTP_USER/SMTP_PASS vacíos el envío queda desactivado y la UI avisa.
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
# Remitente visible; por defecto la misma casilla del SMTP.
MAIL_FROM = os.environ.get("MAIL_FROM", "") or SMTP_USER
MAIL_FROM_NAME = os.environ.get("MAIL_FROM_NAME", "Argentina Color")
# Destinatarios por defecto de las transferencias (editables en cada envío).
# TO = destinatario principal; CC = en copia. En .env, separados por coma:
#   MAIL_TRANSFER_TO="walter.via@argentinacolor.com"
#   MAIL_TRANSFER_CC="paula@argentinacolor.com, marcos.j@argentinacolor.com"
def _emails_env(key):
    return [e.strip() for e in os.environ.get(key, "").replace(";", ",")
            .split(",") if e.strip()]


MAIL_TRANSFER_TO = _emails_env("MAIL_TRANSFER_TO")
MAIL_TRANSFER_CC = _emails_env("MAIL_TRANSFER_CC")
