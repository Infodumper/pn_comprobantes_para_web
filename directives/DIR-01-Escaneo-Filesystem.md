# Directiva: Escaneo, Naming y Normalización de Filesystem (DIR-01)

## 1. Objetivo
Supervisar las rutas locales sincronizadas de Google Drive (`02 PAGOS`), identificar carpetas de campaña bajo nomenclatura estándar, extraer metadatos iniciales del nombre de los archivos y mantener la persistencia en caché local sin bloqueos de concurrencia.

---

## 2. Reglas de Negocio
1. **Detección de Carpetas**:
   - Toda campaña comercial responde al patrón `CnnAA` (ej: `C1126` = Campaña 11 del año 2026) o variaciones como `C1126 TOTAL`, `1126`.
   - El escaneo debe ser recursivo sobre subcarpetas (ej: `TORRES`, `LOCAL`).
2. **Estandarización de Archivos**:
   - Extensiones admitidas: `.jpg`, `.jpeg`, `.png`, `.pdf`.
   - Los nombres siguen la convención `[Campana] [Monto] [Cliente/Referencia].[ext]`.
   - Se debe tolerar tanto con prefijo `C` (`C1126 12000 CLIENTE.jpeg`) como sin prefijo `C` (`1126 12000 CLIENTE.jpeg`).
3. **Persistencia y Caché**:
   - Los datos ya procesados se almacenan en `destinatarios_cache.json` y `registro_subidos.json`.
   - Nunca re-procesar archivos cuyo estado y destinatario ya estén firmados en la caché local salvo solicitud forzada de resincronización.

---

## 3. Skills Asociadas (Regla 1:3)

### SKL-FS-01: Campaign Discovery
- **Responsabilidad**: Localización dinámica de la carpeta raíz de campaña dentro de la ruta configurada en `config.json` (`driveBasePath`).
- **Implementación**: Exploración recursiva de directorios ignorando archivos temporales o del sistema (`Thumbs.db`, `.DS_Store`).

### SKL-FS-02: Receipt Filename Parser
- **Responsabilidad**: Expresiones regulares para segmentar código de campaña, monto teórico y nombre o referencia del titular desde el nombre del archivo.
- **Heurística**: Normalizar montos removiendo puntos de miles y asegurando correspondencia entera o decimal.

### SKL-FS-03: Local Cache Persistence
- **Responsabilidad**: Gestión de lectura y escritura en archivos JSON locales (`destinatarios_cache.json`, `registro_subidos.json`).
- **Garantías**: Escrituras atómicas con UTF-8 para evitar corrupción ante cierres inesperados de la aplicación.
