# Manual de Usuario
## Sistema de Comprobantes Web · Perla Negra SRL

Bienvenido al **Sistema de Comprobantes Web de Perla Negra SRL**. Esta plataforma permite consultar el historial de comprobantes registrados por cliente y automatizar la lectura, verificación y carga masiva de comprobantes organizados por campaña en Google Drive.

---

## 1. Acceso al Sistema

### 1.1 Inicio Automático
El sistema cuenta con un servidor unificado que inicia automáticamente en segundo plano cada vez que se enciende o reinicia el equipo con Windows 11. No es necesario abrir terminales ni ejecutar comandos manuales.

### 1.2 Formas de Ingresar
* **Desde el Escritorio**: Haz doble clic en el acceso directo **Comprobantes Web**.
* **Desde cualquier navegador web** (Chrome, Edge, Firefox):
  * Ingresa a: [http://localhost/comprobantes_para_web/](http://localhost/comprobantes_para_web/)
* **Desde otros equipos de la red local**:
  * Ingresa a: `http://192.168.0.9/comprobantes_para_web/`

---

## 2. Navegación Principal

En la parte superior de la pantalla encontrarás el menú de navegación con dos módulos principales:

1. 📄 **Ver Comprobantes Cargados**: Consulta histórica de comprobantes registrados en Perla Negra por DNI.
2. 📤 **Cargar Comprobantes**: Automatización del escaneo de carpetas de campañas en Google Drive, verificación de importes y subida por lotes.

En el extremo superior derecho, el indicador **API Conectada** confirma que el enlace con la base de datos de Perla Negra se encuentra operativo.

---

## 3. Módulo 1: Ver Comprobantes Cargados

Este módulo permite visualizar el listado completo de pagos y transferencias registradas para un cliente en la base central de Perla Negra SRL.

### 3.1 Cómo realizar una consulta
1. Haz clic en la pestaña **Ver Comprobantes Cargados**.
2. En la casilla **DNI del Cliente**, ingresa el número de documento (con o sin puntos, por ejemplo: `30123456`).
3. Presiona la tecla **Enter** o haz clic en el botón azul **Consultar Comprobantes**.

### 3.2 Visualización de Resultados
Una vez realizada la consulta, el sistema muestra:
* **Ficha del Cliente**: Nombre completo, DNI y cantidad total de comprobantes encontrados.
* **Alternancia de Vistas**:
  * **Por Meses (Predeterminado)**: Organiza los comprobantes en tarjetas agrupadas cronológicamente por mes y año.
  * **Tabla**: Muestra un listado tabular continuo con columnas de Fecha/Hora, Archivo, Tipo, Monto y botón de visualización.
* **Ver Comprobante Original**: Cada tarjeta o fila cuenta con un botón para abrir el archivo original directamente en una pestaña nueva.

### 3.3 Exportación de Datos
En la esquina superior de los resultados dispones de botones para exportar el listado:
* **Descargar Excel (.xls)**: Genera una planilla compatible con Microsoft Excel con fecha, cliente, montos y enlaces a cada archivo.
* **Descargar JSON**: Exporta la estructura completa de datos en formato JSON para integraciones externas.

---

## 4. Módulo 2: Cargar Comprobantes (Automatización por Campaña)

Este módulo automatiza la lectura y carga de comprobantes desde las carpetas locales sincronizadas de Google Drive (`C:\PerlaNegra\02 PAGOS`).

### 4.1 Formato de Campañas
Las campañas se identifican con la nomenclatura **`CnnAA`**:
* **`C`**: Identificador de Campaña.
* **`nn`**: Número de dos dígitos de la campaña (ej. `09`, `10`, `13` para la campaña extra de diciembre).
* **`AA`**: Dos dígitos del año (ej. `26` para 2026).
* *Ejemplos válidos*: `C1026`, `C0926`, `C1326`.

### 4.2 Escaneo de una Campaña
1. Dirígete a la pestaña **Cargar Comprobantes**.
2. Selecciona una de las carpetas detectadas en los accesos rápidos (ej: `📁 C1026`) o escribe el código en el recuadro y pulsa **Escanear Carpeta de Campaña**.
3. El sistema inspecciona los archivos, lee su contenido y presenta el resumen:
   * **Encontrados**: Cantidad total de archivos en la carpeta de Drive.
   * **Ya Subidos**: Cantidad de comprobantes registrados previamente en el sistema.
   * **Faltan Subir**: Comprobantes pendientes de carga.

---

## 5. La Tabla de Comprobantes y Ordenamiento Interactivo

La tabla presenta la información ordenada y estructurada en cinco columnas estratégicas, permitiendo **ordenamiento interactivo con un solo clic**:

| Columna | Descripción y Ordenamiento |
| :--- | :--- |
| **Casilla (☑)** | Permite seleccionar qué comprobantes subir en el lote activo (hasta 10). Incluye casilla maestra en cabecera para marcar/desmarcar los comprobantes del lote. Los ya subidos aparecen desactivados en gris. |
| **Nombre del Archivo ⇅** | Muestra el nombre físico del archivo y, debajo, una cápsula con la lectura inteligente: `DESDE: (Banco emisor) • PARA: Empresa`. **Haz clic en el encabezado para ordenar alfabéticamente (A-Z o Z-A)**. |
| **Cliente ⇅ / Importe ⇅** | Nombre del cliente arriba y el importe en verde abajo. **Haz clic sobre "Cliente" para ordenar alfabéticamente por cliente, o sobre "Importe" para ordenar numéricamente por monto (menor a mayor o viceversa)**. |
| **Imagen** | Miniatura del comprobante. Al posar el cursor sobre la imagen, esta **se amplía (zoom)** automáticamente para verificar los datos sin salir de la pantalla. Si es un PDF, muestra el botón para abrirlo. |
| **Estado** | Indicador circular con letra inicial y color normado: **P** (Pendiente), **E** (Enviado), **F** (Fallido). |

---

## 6. Organización en Lotes de hasta 10 Comprobantes

Debido a que el portal central admite la carga de **hasta 10 comprobantes por vez**, la aplicación organiza los comprobantes automáticamente en **Lotes de 10**:

1. **Barra de Lotes (`Lote 1`, `Lote 2`... `Ver Todos`)**:
   * Cada botón representa un lote de hasta 10 comprobantes con su contador de pendientes (`10 pend.`) o tilde verde (`✓`) cuando todos sus comprobantes ya fueron enviados.
   * Al hacer clic en un lote, la tabla muestra únicamente los 10 comprobantes correspondientes a ese grupo.
2. **Límite Estricto de 10 Seleccionados**:
   * Para evitar errores en la subida, el sistema no permite marcar más de 10 comprobantes a la vez. Si intentas marcar un 11°, un aviso te recordará: *«Solo se pueden subir hasta 10 comprobantes a la página por vez»*.
3. **Botón Rápido «⚡ Marcar 10 Pendientes»**:
   * Un solo clic marca automáticamente los 10 comprobantes pendientes del lote activo o los siguientes 10 pendientes de la campaña.
4. **Flujo Ágil y Avance Automático**:
   * Al hacer clic en **Subir 10 Comprobantes (Lote X)**, se sube el grupo seleccionado. Al concluir la subida, el sistema avanza automáticamente y prepara los siguientes 10 pendientes para que puedas continuar sin demoras.

---

## 6. Auditoría y Verificación de Importes (Alerta en Rojo)

El sistema incorpora un mecanismo de triple cotejo de importes para prevenir errores humanos o transferencias con montos discordantes:

### ¿Cuáles son los tres valores comparados?
1. **Importe del Nombre**: El valor numérico tipeado en el nombre del archivo inmediatamente después del código de campaña (ej: en `C1026 100000 hilda cruz.jpeg`, el valor es `100000`).
2. **Importe de Fila**: El importe asignado en la columna *Cliente / Importe*.
3. **Importe del Comprobante (Documento)**: El monto exacto leído por OCR o análisis de texto dentro de la imagen o del PDF de la transferencia (ej: `$ 100.000,00`).

### ¿Qué ocurre si alguno de los valores no coincide?
* El **nombre del archivo se tiñe de color ROJO intenso**.
* Se añade una insignia `⚠️ Importe`.
* Al pasar el cursor sobre el nombre, un mensaje detalla exactamente la causa (ej: *«Discrepancia: El nombre dice $225650 pero el comprobante dice $225950»* o *«No se detectó importe legible en el comprobante»*).
* Si todos los valores concuerdan, el nombre permanece en su color azul institucional normal.

---

## 7. Lectura de Banco Origen (`DESDE:`) y Cuenta Destino (`PARA:`)

Debajo del nombre de archivo, el sistema extrae automáticamente la procedencia y el destino:
* **`DESDE:`**: Identifica la entidad desde la cual el cliente emitió la transferencia (ej: **Mercado Pago**, **Naranja X**, **Cuenta DNI**, **Banco Credicoop**, **Banco Nación**, **Santander**, **Galicia**, **BBVA**, **Personal Pay**, etc.).
* **`PARA:`**: Muestra a nombre de quién se acreditó el pago. Todas las variantes de cuentas de la compañía (*"Perla Negra Srl"*, *"PERLA NEGRA SRL"*, *"Perla Negra Srl Cuenta Santander..."*, etc.) se unifican bajo la etiqueta clara y destacada **`Empresa`** en color verde institucional. Si un cliente transfirió a un tercero particular o a una cuenta no autorizada, aparecerá el nombre del receptor en lugar de `Empresa`, permitiendo advertir desvíos al instante.

---

## 8. Subida de Comprobantes por Lotes

1. Selecciona los comprobantes pendientes que deseas subir (o utiliza la casilla del encabezado para marcar todos).
2. Haz clic en el botón principal: **Subir X Comprobantes Seleccionados**.
3. Se desplegará una **Barra de Progreso en Vivo** indicando:
   * Porcentaje completado.
   * Número de comprobante procesándose (ej: *Subiendo comprobante 5 de 42...*).
   * Nombre del archivo actual.
4. Conforme se suben, su estado cambia automáticamente a <span style="display:inline-block; width:18px; height:18px; line-height:16px; border-radius:50%; text-align:center; font-weight:bold; background:#F0FDF4; color:#16A34A; border:1px solid #86EFAC; font-size:0.75rem;">E</span> (Enviado), su casilla se desactiva y el contador de faltantes disminuye en tiempo real.
5. El sistema actualiza el registro local `registro_subidos.json`, impidiendo que se vuelvan a subir por duplicado en el futuro.

---

## 9. Preguntas Frecuentes

### ¿Qué hago si un archivo dice "Pendiente de sincronizar"?
Ocurre cuando Google Drive para Escritorio tiene el archivo en la nube pero aún no lo ha descargado a la unidad local (marcador de posición). Abre la carpeta en el Explorador de Windows o abre Google Drive para que termine de sincronizar el archivo.

### ¿Puedo subir solo algunos comprobantes?
Sí. Puedes desmarcar las casillas de los comprobantes que desees omitir y solo se enviarán los que tengan su casilla marcada.

### ¿Puedo buscar por banco o por importe?
Sí. El recuadro de filtro rápido permite buscar tanto por nombre de cliente, nombre de archivo, monto o banco (ej: escribir `"Credicoop"` o `"Naranja"` filtrará únicamente esos comprobantes).
