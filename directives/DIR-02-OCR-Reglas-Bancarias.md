# Directiva: Extracción OCR Híbrida y Reglas Bancarias (DIR-02)

## 1. Objetivo
Extraer texto y metadatos críticos desde comprobantes de transferencia (imágenes y PDFs) utilizando aceleración de hardware en Windows, identificar la entidad emisora, validar el destino corporativo (Perla Negra SRL) y extraer el importe documental exacto evitando falsos positivos.

---

## 2. Reglas de Negocio
1. **Identificación de Empresa (Destino)**:
   - Todo comprobante debe acreditar acreditación en favor de la cuenta recaudadora institucional.
   - Variantes reconocidas: `Perla Negra SRL`, `Perla Negra`, `Perlanegra`.
   - CUIT institucional: `30-70865775-8` (o `30708657758`).
   - CBU institucional: `0720164220000001125540` (Banco Santander).
   - Comprobantes con destino particular o tercero deben clasificarse como `No Empresa` (badge rojo `⚠️ No Empresa`) y excluirse de la subida masiva.
2. **Entidades Bancarias y Billeteras**:
   - Detección por patrones de texto y prefijos de CVU/CBU:
     - Mercado Pago: CVU `00000031...` o palabras clave `mercado pago`.
     - Naranja X: CVU `453...` o palabras clave `naranja x`, `naranjax`, `naranja)(`.
     - Cuenta DNI: Cód. Referencia de 8 dígitos o `cuenta dni`, `bapro`.
     - Personal Pay: CVU `00000062...`
     - Ualá: CVU `00000079...`
     - Banco Santander / Nación / Galicia / BBVA / Macro según encabezados de débito.
3. **Validación de Importes y Blindaje contra Fechas**:
   - El importe documental (`montoDoc`) debe coincidir con el monto del nombre de archivo.
   - **Regla estricta**: Los días del mes y sellos horarios (ej: `23/NOV/2026-13:16 h`) jamás deben capturarse como importes.
   - **Fallback por doble pasada**: Si la imagen completa no reporta importe debido a diferencias tipográficas o barras de estado móviles (como ocurre en Naranja X), se ejecuta una segunda pasada recortando el tercio superior de la tarjeta de transferencia.

---

## 3. Skills Asociadas (Regla 1:3)

### SKL-OCR-01: WinRT Hardware OCR
- **Responsabilidad**: Interoperabilidad con el motor nativo `Windows.Media.Ocr` desde PowerShell/.NET.
- **Capacidades**: Renderizado en memoria de página 0 para archivos PDF escaneados (`Windows.Data.Pdf.PdfDocument`) y recorte dinámico en memoria (`InMemoryRandomAccessStream`) para segundas pasadas.

### SKL-OCR-02: Banking Entity Resolver
- **Responsabilidad**: Análisis contextual para separar cuenta origen de cuenta destino, resolviendo si Santander o Perla Negra figura como emisor o receptor.
- **Extracción**: Captura de titular, banco origen, CBU/CVU y número de operación.

### SKL-OCR-03: Financial Amount Extractor
- **Responsabilidad**: Normalización de importes argentinos (conversión de formatos `12.000,00`, `12.000` y centavos en superíndice `12.000 00` a flotante o entero).
- **Protección**: Filtro de exclusión con *negative lookahead* contra separadores de fecha (`/`, `-`) y meses (`ene`..`dic`).
