# Arquitectura y Estándares de Sistema – "Comprobantes Web Perla Negra"

> Este documento define la orquestación de agentes, estándares técnicos y reglas operativas para la auditoría, extracción OCR y sincronización de comprobantes bancarios hacia la API central de Perla Negra SRL.

---

## 1. Alcance Operativo

El sistema **Comprobantes Web** es la plataforma local de procesamiento y validación documental para campañas comerciales. Automatiza:
1. El escaneo y clasificación de comprobantes almacenados en Google Drive local (`CnnAA`, ej: `C1126`).
2. La extracción acelerada por hardware (OCR) para identificar entidades financieras, importes reales y destinatario (Empresa vs No Empresa).
3. La subida controlada por lotes con políticas anti-saturación hacia la API de Google Apps Script.

---

## 2. Arquitectura de 4 Capas (Estandarizada)

El sistema opera bajo el siguiente modelo arquitectónico:

### Capa 1: Gestión de Directivas (`/directives/`)
- Procedimientos Operativos Estandarizados (SOPs) que rigen las reglas de negocio, extracción y contingencia.
- **Directivas operativas**:
  - `DIR-01-Escaneo-Filesystem.md`: Detección de campañas, parseo de nombres y persistencia de caché.
  - `DIR-02-OCR-Reglas-Bancarias.md`: Invocación WinRT OCR, resolución de entidades y extracción financiera sin falsos positivos.
  - `DIR-03-Control-Lotes-API.md`: Control de subida por bloques de 10, backoff por cuota y estado reactivo en UI.

### Capa 2: Orquestación y Skills (Regla 1:3)
- Cada directiva implementa exactamente **3 skills atómicas**:
  - Directiva 1: `SKL-FS-01`, `SKL-FS-02`, `SKL-FS-03`
  - Directiva 2: `SKL-OCR-01`, `SKL-OCR-02`, `SKL-OCR-03`
  - Directiva 3: `SKL-API-01`, `SKL-API-02`, `SKL-API-03`

### Capa 3: Ejecución de Agentes Lógicos
- **AG-01 File & Campaign Scanner**: Monitorea el filesystem y estructura los metadatos de campaña.
- **AG-02 OCR & Banking Auditor**: Ejecuta el motor OCR nativo, detecta discrepancias y previene falsos positivos.
- **AG-03 Batch & API Dispatcher**: Orquesta la sincronización con la API externa bajo políticas anti-bloqueo.

### Capa 4: Observabilidad y Estado Persistente
- Persistencia local en JSON atómico: `registro_subidos.json`, `destinatarios_cache.json`, `ocr_full_cache.json`.
- Indicadores visuales en SPA: Estados `E` (Enviado / Verde), `P` (Pendiente / Naranja), `F` (Fallido / Rojo) y tooltips explicativos de discrepancias.

---

## 3. Mapeo de Agentes, Directivas y Skills

```
┌────────────────────────────────────────────────────────────────────────┐
│                              AGENTS.md                                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
[AG-01 Scanner]             [AG-02 Auditor]                 [AG-03 Dispatcher]
    │                               │                               │
    ▼                               ▼                               ▼
DIR-01 (Filesystem)         DIR-02 (OCR & Bancos)           DIR-03 (Lotes & API)
  ├── SKL-FS-01 Discovery     ├── SKL-OCR-01 WinRT OCR        ├── SKL-API-01 Pacing
  ├── SKL-FS-02 Naming        ├── SKL-OCR-02 Bank Resolver    ├── SKL-API-02 Resilience
  └── SKL-FS-03 Cache JSON    └── SKL-OCR-03 Amount Parser    └── SKL-API-03 SPA State
```

---

## 4. Estándares Técnicos

- **Frontend**: SPA ligera en Vanilla JS y CSS3 modular (sin frameworks pesados). Paleta institucional: Azul `#0B2545`, Verde `#2E7D32`, Ámbar `#D97706`, Rojo `#DC2626`.
- **Backend**: Node.js nativo (servidor HTTP estándar, recarga en caliente de módulos de API).
- **OCR Engine**: WinRT nativo (`Windows.Media.Ocr`) vía PowerShell 5.1/7+ con renderizado de PDF en memoria.
- **Versionado de Assets**: Cache-busting mandatorio con query string `?v=YYYYMMDD_XX` en `index.html`.
