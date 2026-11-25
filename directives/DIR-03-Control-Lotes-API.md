# Directiva: Control de Lotes y Sincronización con API Externa (DIR-03)

## 1. Objetivo
Administrar el ciclo de subida de comprobantes validados hacia la API central de Perla Negra (Google Apps Script / Spreadsheet), implementando políticas anti-bloqueo por cuotas, pacing de red y retroalimentación reactiva en la interfaz de usuario.

---

## 2. Reglas de Negocio
1. **Estructura de Subida en Bloques de 10**:
   - Los comprobantes seleccionados se procesan en bloques de hasta 10 elementos.
   - El DNI del operador se valida **una sola vez** al inicio de la tanda (`/api/verificar-cliente`), nunca archivo por archivo.
2. **Pacing y Prevención de Rate Limiting**:
   - Pausa mínima de **2,5 segundos** entre envíos individuales de un mismo bloque.
   - Descanso obligatorio de **10 segundos** al finalizar un bloque antes de comenzar el siguiente.
   - Si la API responde con `{ codigo: "limite" }`, el sistema debe pausar automáticamente durante **35 segundos** y reintentar la subida sin abortar la cola.
3. **Manejo de Respuestas de la API**:
   - `ok: true`: Subida exitosa, registrar con `estado: "SUBIDO"`.
   - `codigo: "duplicado"`: El archivo ya existía en la base central; se considera resuelto sin error y se marca como subido.
   - `ok: false`: Error transitorio; marcar con badge rojo `F: Fallido` y permitir reintento manual.
4. **Visibilidad y Estados en UI**:
   - Los archivos subidos se identifican con la insignia `E` (verde).
   - Los pendientes con `P` (naranja).
   - Los fallidos con `F` (rojo).
   - Las discrepancias reales de importe bloquean la selección predeterminada para evitar cargas con datos incorrectos.

---

## 3. Skills Asociadas (Regla 1:3)

### SKL-API-01: Batch Pacing Controller
- **Responsabilidad**: Temporizador y cola asíncrona de envíos por lotes de 10 con retardos configurables (2,5s inter-item y 10s inter-bloque).
- **Control**: Pausa y reanudación manual o automática por cuota de servidor.

### SKL-API-02: External API Resilience
- **Responsabilidad**: Transformación de payload a Base64, autenticación con DNI y manejo de códigos de retorno (`limite`, `duplicado`, `error`).
- **Resiliencia**: Retroceso exponencial (*backoff*) ante congestión de red o respuestas 429/503.

### SKL-API-03: Single Page UI State Sync
- **Responsabilidad**: Actualización reactiva del DOM (tabla de comprobantes, barras de progreso, modal de vista previa de adjuntos y filtros por campaña).
- **Exportación**: Generación y descarga del reporte Excel consolidado (`generar_excel.js`) con columnas de verificación (DESDE, PARA, ESTADO).
