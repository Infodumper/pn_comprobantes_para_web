# Manual Técnico de Arquitectura y Mantenimiento
## Sistema de Comprobantes Web · Perla Negra SRL

Este documento detalla la arquitectura técnica, flujo de datos, algoritmos de reconocimiento y procedimientos de mantenimiento del **Sistema de Comprobantes Web**.

---

## 1. Arquitectura General del Sistema

El sistema implementa una arquitectura desacoplada y liviana diseñada para ejecutarse de manera desatendida en un entorno de trabajo local sobre **Windows 11**:

```
[ Navegador Web ] (Frontend HTML5 / CSS3 / Vanilla JS)
        │
        │ HTTP (Puerto 80: http://localhost)
        ▼
[ C:\TGPN\server.js ] (Servidor HTTP Central Node.js v24)
        │
        ├── Enrutamiento Estático: Sirve todos los proyectos de C:\TGPN (SIGO, Comprobantes, etc.)
        │
        └── Delegación de API (/api/*): ──► [ comprobantes_para_web\api.js ]
                                                    │
                                                    ├── Lector PDF: pdf-parse (Node.js)
                                                    │
                                                    ├── Lector OCR Imágenes: extract_ocr.ps1
                                                    │     (WinRT: Windows.Media.Ocr.OcrEngine)
                                                    │
                                                    ├── Google Drive: C:\PerlaNegra\02 PAGOS
                                                    │
                                                    └── Base Remota: Google Apps Script Webhook
```

### 1.1 Características de la Arquitectura
* **Servidor Central Unificado en Puerto 80**: Escucha en `0.0.0.0:80` atendiendo simultáneamente `comprobantes_para_web`, `SIGO` y cualquier otro directorio dentro de `C:\TGPN`.
* **Cero dependencias pesadas de OCR**: Utiliza la API nativa de Windows 11 Runtime (`Windows.Media.Ocr`) en español (`es-ES`/`es-MX`), procesando imágenes a más de 20 archivos por segundo sin requerir Tesseract ni Python.
* **Persistencia ligera en JSON**: El registro de archivos enviados y la caché de OCR se guardan en archivos JSON locales sin necesidad de un motor SQL complejo.

---

## 2. Componentes y Archivos del Proyecto

Ruta base del proyecto: `c:\TGPN\comprobantes_para_web\`

| Archivo / Carpeta | Tipo | Rol y Responsabilidad |
| :--- | :--- | :--- |
| `index.html` | Frontend | Estructura semántica, accesibilidad y contenedores de vistas (Consulta y Carga). |
| `styles.css` | Frontend | Tokens de diseño Kaizuna (`#145890`, `#5A8259`, `#FAF9F6`), insignias de estado, miniaturas y clases de alerta de importe. |
| `app.js` | Frontend | Lógica de cliente: tabs, filtros, cotejo de importes, renderizado dinámico, subida masiva y progreso. |
| `api.js` | Backend | Controlador de endpoints REST, parsing de nombres, caché y coordinación de lectores. |
| `extract_ocr.ps1` | Backend (PowerShell) | Script de OCR nativo por lotes que procesa imágenes `.jpeg`, `.jpg`, `.png` mediante WinRT. |
| `config.json` | Configuración | Almacena rutas base configurables (`driveBasePath`). |
| `registro_subidos.json` | Persistencia | Historial estructurado por campaña de los archivos ya enviados exitosamente. |
| `destinatarios_cache.json` | Persistencia | Caché de metadatos leídos (origen, destino, importe leído) para evitar reescanear archivos ya procesados. |
| `assets/logopn.png` | Recursos | Isologotipo institucional de Perla Negra SRL. |

---

## 3. Inicio Automático en Windows 11

El servidor se inicializa de forma transparente al iniciar sesión en Windows:

* **Ruta de inicio**: `C:\Users\Administrador\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\servidor_tgpn_startup.vbs`
* **Contenido**:
  ```vbscript
  Set WshShell = CreateObject("WScript.Shell")
  WshShell.CurrentDirectory = "C:\TGPN"
  WshShell.Run "node server.js", 0, False
  ```
* **Acceso Directo**: Ubicado en `C:\Users\Administrador\Desktop\Comprobantes Web.url` apuntando a `http://localhost/comprobantes_para_web/`.

---

## 4. Motor de Reconocimiento y Extracción de Datos

### 4.1 Extracción de Texto en PDFs
Para archivos `.pdf`, se utiliza la biblioteca `pdf-parse` (v2) directamente en el proceso de Node.js:
* Lee los flujos de texto del documento en memoria (5 a 10 ms por archivo).
* Si el PDF fue generado digitalmente por homebanking (Credicoop, Banco Nación, Personal Pay, Santander), el texto se recupera intacto.

### 4.2 Extracción OCR en Imágenes
Para archivos de imagen (`.jpg`, `.jpeg`, `.png`), `api.js` invoca `extract_ocr.ps1` mediante `child_process.execFileSync`:
* Utiliza `Windows.Graphics.Imaging.BitmapDecoder` para abrir el stream de la imagen.
* Ejecuta `Windows.Media.Ocr.OcrEngine::TryCreateFromUserProfileLanguages()`.
* Extrae el texto completo en segundos de forma 100% offline.
* **Tolerancia a fallos**: Captura excepciones de I/O (`0x88982F60` o archivos no hidratados de Drive) asignando el estado `"Pendiente de sincronizar"`.

---

## 5. Algoritmos de Detección

### 5.1 Detección del Banco Emisor (`DESDE:`)
Para evitar el falso positivo donde **Santander** se marcaba erróneamente en todos los comprobantes (dado que la cuenta recaudadora de Perla Negra es del Santander: `CBU 0720164220000001125540`), el algoritmo evalúa en el siguiente orden:

1. **Entidades con firmas de emisión inequívocas**:
   * **Banco Credicoop**: `/\b(?:credicoop|banco\s*credicoop)\b/i`
   * **Mercado Pago**: `/\b(?:mercado\s*pago|mercadopago)\b/i` o CVU iniciado en `00000031`
   * **Naranja X**: `/\b(?:naranja\s*x|naranjax|naranja\s*digital)\b/i` o CBU iniciado en `453`
   * **Cuenta DNI**: `/\b(?:cuenta\s*dni|banco\s*provincia|bapro)\b/i` o `código de referencia \d{8}`
   * **Personal Pay**: `/\b(?:personal\s*pay|personalpay)\b/i` o CVU iniciado en `00000062`
   * **Banco Nación**: `/\b(?:banco\s*(?:de\s+la\s+)?naci[oó]n|bna\+?)\b/i`
   * **Galicia**, **BBVA**, **Brubank**, **Ualá**, **Macro**, **Patagonia**, etc.
2. **Filtro estricto para Santander**:
   * Solo se reconoce como origen si contiene marcas de débito propio (`Online Banking Personas`, `Cuenta débito`, `Importe debitado`).
   * Se descartan las menciones de Santander si se encuentran dentro de las secciones de `Beneficiario`, `Para`, `Destino` o `Banco del Beneficiario`.

### 5.2 Detección de Cuenta Destino (`PARA:`) y Unificación como `Empresa`
Busca campos donde se acredite la transferencia:
* Patrones: `beneficiari[oa]`, `cuenta destino`, `para:`, `destinatari[oa]`, `transferencia enviada a`.
* Se limpian prefijos parásitos (ej: `Apellido y Nombre`, `Titular`).
* **Regla de Unificación Corporativa**: Cualquier variación de la razón social detectada (`PERLA NEGRA`, `Perla Negra Srl`, `ria negra`, `perlanegra`, etc.) se unifica automáticamente a la etiqueta **`Empresa`**. Si un pago se acreditó a una cuenta particular o de un tercero no autorizado, conserva el nombre detectado para llamar la atención del operador.

### 5.3 Extracción y Normalización de Importes
La función `normalizeAmount(str)` estandariza los formatos numéricos argentinos a valores tipo `Number`:
* Formato con miles y coma decimal: `101.600,00` ➔ `101600`
* Formato con miles sin centavos: `101.600` ➔ `101600`
* Formato continuo con coma: `100000,00` ➔ `100000`
* Formato entero plano: `10000` ➔ `10000`

---

## 6. Lógica de Triple Cotejo de Importes (Alerta en Rojo)

El frontend (`app.js`) y el backend colaboran para validar la concordancia de tres variables:

```javascript
// 1. Importe extraído del nombre del archivo tras el código de campaña
const matchNombre = item.nombre.match(/^C\d{4}\s+([\d.]+)/i);
const montoNombre = matchNombre ? normalizarMonto(matchNombre[1]) : null;

// 2. Importe en la columna Cliente / Importe
const montoCliente = normalizarMonto(item.monto);

// 3. Importe extraído por OCR / PDF del documento
const montoDoc = item.montoDoc !== null ? normalizarMonto(item.montoDoc) : null;

// Regla de concordancia estricta
const coincidenTres = Boolean(
  montoNombre !== null &&
  montoCliente !== null &&
  montoDoc !== null &&
  montoNombre === montoCliente &&
  montoNombre === montoDoc
);
```

### Reglas de Presentación:
* Si `coincidenTres === true`: El nombre de archivo se muestra en `--azul-kaizuna` (`#145890`) o gris si ya está subido.
* Si `coincidenTres === false`:
  * El texto se renderiza en **Rojo de Alerta** (`#DC2626`, clase `.receipt-file-title--mismatch`).
  * Se inserta la etiqueta visible `⚠️ Importe`.
  * Se asigna el atributo `title` con el desglose del error (ej: *«Discrepancia: El nombre dice $225650 pero el comprobante dice $225950»*).

---

## 7. Organización por Lotes (Hasta 10 por Envío) y Ordenamiento

### 7.1 Lotes de Subida de hasta 10 Comprobantes
El portal de destino impone un límite de **10 comprobantes por transmisión**. El frontend implementa esta restricción de forma nativa:
* **Estado de Lote**: `state.tamanoLote = 10`, `state.loteActual = 1` (o `0` para "Ver Todos").
* **Segmentación de Datos**: `getArchivosVisibles()` aplica paginación reactiva sobre los archivos filtrados y ordenados (`todosFiltrados.slice(inicio, fin)`).
* **Control Estricto de Selección**: `window.toggleSeleccionArchivo` bloquea cualquier intento de marcar un 11° comprobante simultáneo, emitiendo una notificación informativa.
* **Procesamiento de Envío**: `subirComprobantesFaltantes()` toma estrictamente `aSubir.slice(0, 10)` y, tras concluir el lote, avanza automáticamente a los siguientes 10 comprobantes pendientes.

### 7.2 Ordenamiento Multi-Criterio de la Tabla
La tabla cuenta con cabeceras ordenables interactivas controladas por `state.ordenCampana: { campo, direccion }`:
* **Por Nombre de Archivo**: `a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' })` (ordenamiento natural considerando números).
* **Por Cliente**: Comparación alfabética insensible a mayúsculas sobre `a.cliente`.
* **Por Importe**: Comparación numérica basada en `normalizarMonto(a.monto)`.
* Cada cabecera expone indicadores direccionales reactivos (`▲` para ascendente, `▼` para descendente, `⇅` para neutro).

---

## 8. Endpoints de la API

Prefijo admitido: `/api/*` y `/comprobantes_para_web/api/*`.

### `GET /api/config`
Devuelve la configuración del sistema y verifica la existencia del directorio de Drive.
* **Respuesta**: `{ "ok": true, "config": { "driveBasePath": "C:\\PerlaNegra\\02 PAGOS" }, "folderExists": true }`

### `GET /api/campanas`
Explora el directorio base y devuelve todas las carpetas que coincidan con el patrón de campaña `CnnAA`.

### `GET /api/escanear-campana?campana=C1026`
Escanea la carpeta de la campaña seleccionada:
* Lista todos los archivos `.jpg`, `.jpeg`, `.png` y `.pdf`.
* Consulta `destinatarios_cache.json`; para los archivos no cacheados, ejecuta OCR y extracción de importes.
* Cruza contra `registro_subidos.json` para definir `estado` (`PENDIENTE` o `SUBIDO`).
* **Respuesta**:
  ```json
  {
    "ok": true,
    "campana": "C1026",
    "carpeta": "C:\\PerlaNegra\\02 PAGOS\\C1026 TOTAL",
    "totalArchivos": 61,
    "totalSubidos": 0,
    "totalPendientes": 61,
    "archivos": [
      {
        "nombre": "c1026 10000 clara nieto.jpeg",
        "monto": "10000",
        "montoDoc": 10000,
        "cliente": "clara nieto",
        "origen": "Naranja X",
        "destinatario": "Empresa",
        "estado": "PENDIENTE",
        "subidoInfo": null
      }
    ]
  }
  ```

### `GET /api/comprobante-preview?campana=C1026&archivo=nombre.jpeg`
Sirve el archivo para visualización en navegador o miniatura. Implementa streaming con manejo de eventos `'error'` para tolerar archivos no hidratados de Drive.

### `POST /api/subir-comprobante`
Envía el comprobante individual en Base64 al webhook de Google Apps Script:
* **Endpoint Remoto**: `https://script.google.com/macros/s/AKfycbxMpLnqYvBR7A9OyliThTVm0VclyNIgRVflD9l3cM_2ry34971Z4lk5oJFT6Uw3S6ln/exec`
* **Payload**:
  ```json
  {
    "dni": "0",
    "archivo": "<Base64_String>",
    "nombreArchivo": "c1026 10000 clara nieto.jpeg",
    "mimeType": "image/jpeg",
    "campana": "C1026"
  }
  ```
* Tras la confirmación, actualiza de inmediato `registro_subidos.json`.

---

## 8. Diagnóstico y Comandos de Mantenimiento

### Comprobar estado del servidor
```powershell
Get-NetTCPConnection -LocalPort 80 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, State, OwningProcess
```

### Reiniciar el servicio manualmente
```powershell
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Start-Process "C:\Users\Administrador\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\servidor_tgpn_startup.vbs"
```

### Probar OCR manualmente en una imagen
```powershell
powershell -ExecutionPolicy Bypass -File C:\TGPN\comprobantes_para_web\extract_ocr.ps1 -FolderPath "C:\PerlaNegra\02 PAGOS\C1026 TOTAL"
```

### Limpiar caché de OCR (para forzar relectura de una campaña)
Basta con eliminar el archivo `destinatarios_cache.json`:
```powershell
Remove-Item "C:\TGPN\comprobantes_para_web\destinatarios_cache.json" -ErrorAction SilentlyContinue
```
El sistema lo regenerará automáticamente en el siguiente escaneo.
