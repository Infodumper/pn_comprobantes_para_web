# ENGRAM: SISTEMA DE COMPROBANTES WEB · PERLA NEGRA SRL

> **Memoria Persistente y Transferencia de Contexto para Antigravity**  
> **Ubicación:** `C:\TGPN\comprobantes_para_web\ENGRAM.md`  
> **Versión Actual:** Beta 1 (Noviembre 2026)  
> **Repositorio Remoto:** `https://github.com/Infodumper/pn_comprobantes_para_web.git` (rama `main`)  
> **Servidor Host Local:** `C:\TGPN\server.js` (Puerto 80, recarga en caliente de `api.js`)

---

## 1. PROPÓSITO DEL SISTEMA

Aplicación web local desarrollada en Vanilla JS, CSS3 moderno y Node.js para **Perla Negra SRL** con dos módulos centrales:
1. **Ver Comprobantes Cargados**: Consulta contra la base de datos central de Perla Negra (Google Apps Script / Spreadsheet) para verificar comprobantes registrados por DNI.
2. **Cargar Comprobantes (Automatización por Campaña)**: Escaneo de carpetas de Google Drive (`CnnAA`, ej: `C1126`), extracción inteligente por OCR, validación de destinatario y subida por lotes controlados para evitar la saturación del servidor.

---

## 2. ARQUITECTURA TÉCNICA Y REGLAS DE NEGOCIO

### 2.1. Conexión con Perla Negra (Google Apps Script API)
- **Endpoint central:** `https://script.google.com/macros/s/AKfycbxMpLnqYvBR7A9OyliThTVm0VclyNIgRVflD9l3cM_2ry34971Z4lk5oJFT6Uw3S6ln/exec`
- **Acciones principales:**
  - `consultarComprobantes`: Requiere `{ accion: "consultarComprobantes", dni }`.
  - `subirComprobante`: Envía payload `{ dni, archivo: base64, nombreArchivo, mimeType, campana }`.
  - `verificarCliente`: Consulta rápida para validar DNI sin generar subida.
- **Comportamiento del Monto en comprobantes nuevos:**  
  El formulario oficial de Perla Negra NO envía el campo monto. Al subir un comprobante, el backend central lo registra con `estado: "PENDIENTE"` y `monto: ""` (vacío). El monto es completado manualmente o mediante auditoría por la administración central de Perla Negra en su panel (`admin.html`). Cuando se audita, pasa a `CARGADO` con su valor verificado (ej: `75.850,00`).

### 2.2. Subida en Bloques de 10 y Políticas Anti-Saturación
- **Límite por tanda:** Hasta 10 comprobantes por lote (`tamanoLote: 10`).
- **Validación única de DNI:** El DNI se valida **una sola vez** al iniciar el lote (`/api/verificar-cliente`), no archivo por archivo.
- **Pacing de red:**
  - Pausa de **2,5 segundos** entre comprobantes de un mismo lote.
  - Descanso de **10 segundos** entre bloques consecutivos.
  - Detección de límite: Si el servidor devuelve `codigo: "limite"`, el sistema pausa automáticamente **35 segundos** y reintenta sin abortar el proceso.

### 2.3. Lectura OCR y Validación de Destinatario (Empresa vs No Empresa)
- **Motor OCR Híbrido (`extract_ocr.ps1`):**
  - **Imágenes (`.jpg`, `.jpeg`, `.png`):** Windows Media OCR nativo vía WinRT.
  - **Archivos `.pdf`:** Renderizado de página 0 con `Windows.Data.Pdf.PdfDocument` a stream de memoria + Windows Media OCR. Resuelve PDFs escaneados y capturas de pantalla guardadas como PDF (ej. comprobantes de Brubank, Ualá, etc.).
  - **Fallback PDF:** `pdf-parse` para PDFs que contengan texto digital embebido.
- **Identificación de Empresa:**
  - Nombres: `Perla Negra SRL`, `Perla Negra`, `Perlanegra`.
  - CUIT institucional: `30-70865775-8` (o `30708657758`).
  - CBU institucional: `0720164220000001125540` (Santander).
  - Encabezados: `Envío de dinero a`, `Transferencia enviada a`, `Beneficiario`, `Cuenta destino`, `Para`.
- **Caché y Persistencia:**
  - Guardado en `destinatarios_cache.json`.
  - Si un archivo tiene destino diferente a Empresa, se resalta en **ROJO** con la insignia `⚠️ No Empresa` y se **excluye automáticamente** de la selección masiva de subida.
  - **Endpoint de ajuste manual:** `POST /api/actualizar-destinatario` permite modificar el destino desde la interfaz con los botones `Marcar Empresa ✓` y `↺ Desmarcar`.

### 2.4. Filtro por Campaña en "Ver Comprobantes Cargados"
- Extracción dinámica del código de campaña (`CnnAA` o `nnAA`, ej: `C1126`) desde el nombre físico del archivo.
- Selector desplegable y pastillas rápidas (pills) con conteo de comprobantes en tiempo real.
- Inclusión de la columna **Campaña** en la vista Tabla y badge en la vista Por Meses.
- Exportación en Excel (`.xls`) y JSON respetando los filtros activos.

---

## 3. MAPA DE ARCHIVOS Y COMPONENTES

| Archivo | Rol / Responsabilidad |
| :--- | :--- |
| `index.html` | Estructura unificada de la aplicación (SPA). Incluye vistas de Consulta y Carga Automática por Campaña. Versionado con cache-busting (`?v=...`). |
| `styles.css` | Diseño visual responsivo, paleta institucional (Azul Marino #0B2545, Verde #2E7D32, Amarillo de advertencia #D97706, Rojo de alerta #DC2626). |
| `app.js` | Lógica de frontend: navegación, renderizado de tablas, paginación por lotes, control de subidas asíncronas, debounce y filtros interactivos. |
| `api.js` | Backend local en Node.js que expone `/api/escanear-campana`, `/api/subir-comprobante`, `/api/verificar-cliente`, `/api/actualizar-destinatario`, etc. |
| `extract_ocr.ps1` | Script PowerShell para OCR acelerado por hardware en Windows 10/11 para imágenes y PDFs. |
| `MANUAL_USUARIO.md` | Manual exhaustivo para el usuario final con instrucciones paso a paso. |
| `ENGRAM.md` | Este documento de memoria persistente para el agente. |

---

## 4. CONSIGNAS PARA FUTURAS MODIFICACIONES
- **No romper la compatibilidad con Node nativo:** `server.js` y `api.js` deben correr sin frameworks pesados ni dependencias globales complejas.
- **Mantener siempre el cache-busting en `index.html`:** Al modificar `styles.css` o `app.js`, incrementar el parámetro `?v=...` para evitar que el navegador del usuario sirva versiones cacheadas viejas.
- **Priorizar la protección contra rate-limits:** No reducir las pausas de subida por debajo de 2 segundos sin validación previa.
- **Mantener el repositorio sincronizado:** Realizar commits atómicos y claros a `origin/main`.
