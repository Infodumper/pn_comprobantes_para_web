/**
 * ============================================================
 * Sistema de Gestión de Comprobantes Web
 * Perla Negra SRL
 * ============================================================
 */

"use strict";

const API_URL = "https://script.google.com/macros/s/AKfycbxMpLnqYvBR7A9OyliThTVm0VclyNIgRVflD9l3cM_2ry34971Z4lk5oJFT6Uw3S6ln/exec";
const STORAGE_KEY_RECENT_DNI = "pn_recent_dni";
const STORAGE_KEY_CACHE = "pn_cache_comprobantes";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

/* Estado global de la aplicación */
const state = {
  activeView: "seccion-consultar",
  currentDni: "",
  clientName: "",
  comprobantes: [],
  comprobantesFiltrados: [],
  campanasDetectadas: [],
  filtroCampanaResultados: "todas", // "todas" | "C1126" | ... | "sin_campana"
  isConsulting: false,
  displayMode: "meses", // "meses" | "tabla"

  // Estado de Campaña (Google Drive)
  campanaActual: "",
  campanaData: null,
  filtroCampanaTab: "todos", // "todos" | "faltantes" | "subidos"
  filtroDestinatarioTab: "todos", // "todos" | "empresa" | "no_empresa"
  selectedFiles: new Set(), // Nombres de archivos seleccionados con checkbox (máx. 10)
  tamanoLote: 10,
  loteActual: 1, // 1, 2, ... o 0 para 'todos'
  ordenCampana: {
    campo: "nombre", // "nombre" | "cliente" | "monto"
    direccion: "asc" // "asc" | "desc"
  },
  isScanning: false,
  isUploadingBatch: false,

  // Usuario configurado para la subida de comprobantes (.env)
  usuarioSubida: {
    nombre: "Paola Estévez",
    dni: ""
  }
};

/* Elementos del DOM */
const dom = {
  // Tabs
  navBtns: document.querySelectorAll(".nav__btn"),
  views: document.querySelectorAll(".view-panel"),

  // Vista 1: Consulta de Comprobantes
  formConsulta: document.getElementById("form-consulta"),
  inputDniConsulta: document.getElementById("input-dni-consulta"),
  btnConsultarBajar: document.getElementById("btn-consultar-bajar"),
  btnClearDni: document.getElementById("btn-clear-dni"),
  estadoConsulta: document.getElementById("estado-consulta"),
  quickDniContainer: document.getElementById("quick-dni-container"),
  quickTagsList: document.getElementById("quick-tags-list"),

  // Resultados Consulta
  contenedorResultados: document.getElementById("contenedor-resultados"),
  resultadoNombreCliente: document.getElementById("resultado-nombre-cliente"),
  resultadoDniCliente: document.getElementById("resultado-dni-cliente"),
  statTotalComprobantes: document.getElementById("stat-total-comprobantes"),
  statMontoTotal: document.getElementById("stat-monto-total"),
  statCampanasActivas: document.getElementById("stat-campanas-activas"),
  statMesesActivos: document.getElementById("stat-meses-activos"),
  btnExportarExcel: document.getElementById("btn-exportar-excel"),
  btnExportarJson: document.getElementById("btn-exportar-json"),
  filtroTexto: document.getElementById("filtro-texto-resultados"),
  filtroCampanaResultados: document.getElementById("filtro-campana-resultados"),
  quickCampanasBar: document.getElementById("quick-campanas-bar"),
  btnVistaAgrupada: document.getElementById("btn-vista-agrupada"),
  btnVistaTabla: document.getElementById("btn-vista-tabla"),
  vistaMesesContainer: document.getElementById("vista-meses-container"),
  vistaTablaContainer: document.getElementById("vista-tabla-container"),
  tablaBody: document.getElementById("tabla-comprobantes-body"),

  // Vista 2: Carga Automática por Campaña (Google Drive)
  driveBasePathDisplay: document.getElementById("drive-base-path-display"),
  inputCampanaCode: document.getElementById("input-campana-code"),
  btnEscanearCampana: document.getElementById("btn-escanear-campana"),
  campanasTagsList: document.getElementById("campanas-tags-list"),
  estadoEscanearCampana: document.getElementById("estado-escanear-campana"),

  // Resultados de Campaña
  contenedorResultadoCampana: document.getElementById("contenedor-resultado-campana"),
  resumenCampanaCodigo: document.getElementById("resumen-campana-codigo"),
  resumenCampanaCarpeta: document.getElementById("resumen-campana-carpeta"),
  statCampanaTotal: document.getElementById("stat-campana-total"),
  statCampanaSubidos: document.getElementById("stat-campana-subidos"),
  statCampanaFaltantes: document.getElementById("stat-campana-faltantes"),
  btnSubirTodo: document.getElementById("btn-subir-todo"),
  labelSubirTodo: document.getElementById("label-subir-todo"),
  btnSubirFaltantes: document.getElementById("btn-subir-faltantes"),
  labelSubirSeleccionados: document.getElementById("label-subir-seleccionados"),
  btnGenerarExcelCampana: document.getElementById("btn-generar-excel-campana"),

  // Barra de progreso de subida
  progresoSubidaCard: document.getElementById("progreso-subida-card"),
  progresoTitulo: document.getElementById("progreso-titulo"),
  progresoPorcentaje: document.getElementById("progreso-porcentaje"),
  barraProgresoEnvio: document.getElementById("barra-progreso-envio"),
  progresoArchivoActual: document.getElementById("progreso-archivo-actual"),

  // Filtros, Lotes, Ordenamiento y Casilla Selección
  checkMarcarTodos: document.getElementById("check-marcar-todos"),
  filtroArchivosCampana: document.getElementById("filtro-archivos-campana"),
  filtroTabTodos: document.getElementById("filtro-tab-todos"),
  filtroTabFaltantes: document.getElementById("filtro-tab-faltantes"),
  filtroTabSubidos: document.getElementById("filtro-tab-subidos"),
  countBadgeTodos: document.getElementById("count-badge-todos"),
  countBadgeFaltantes: document.getElementById("count-badge-faltantes"),
  countBadgeSubidos: document.getElementById("count-badge-subidos"),

  // Filtros de Destinatario (PARA: Empresa vs No Empresa)
  destFilterToolbar: document.getElementById("dest-filter-toolbar"),
  filtroDestTodos: document.getElementById("filtro-dest-todos"),
  filtroDestEmpresa: document.getElementById("filtro-dest-empresa"),
  filtroDestNoEmpresa: document.getElementById("filtro-dest-no-empresa"),
  countDestTodos: document.getElementById("count-dest-todos"),
  countDestEmpresa: document.getElementById("count-dest-empresa"),
  countDestNoEmpresa: document.getElementById("count-dest-no-empresa"),

  tablaArchivosCampanaBody: document.getElementById("tabla-archivos-campana-body"),

  // Lotes Bar
  lotesBar: document.getElementById("lotes-bar"),
  lotesPillsList: document.getElementById("lotes-pills-list"),
  btnSeleccionar10: document.getElementById("btn-seleccionar-10"),

  // Cabeceras ordenables
  thSortNombre: document.getElementById("th-sort-nombre"),
  btnSortCliente: document.getElementById("btn-sort-cliente"),
  btnSortMonto: document.getElementById("btn-sort-monto"),
  sortIndNombre: document.getElementById("sort-ind-nombre"),
  sortIndCliente: document.getElementById("sort-ind-cliente"),
  sortIndMonto: document.getElementById("sort-ind-monto"),

  // Usuario configurado para subidas (.env)
  navUserNombre: document.getElementById("nav-user-nombre"),
  navUserDniVal: document.getElementById("nav-user-dni-val"),
  userSubidaNombre: document.getElementById("user-subida-nombre"),
  userSubidaDniBadge: document.getElementById("user-subida-dni-badge"),
  userSubidaDniText: document.getElementById("user-subida-dni-text"),
  resumenUsuarioNombre: document.getElementById("resumen-usuario-nombre"),
  resumenUsuarioDni: document.getElementById("resumen-usuario-dni")
};

/* -------------------------------------------------------------
   INICIALIZACIÓN
   ------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupConsultaModule();
  setupCampanaModule();
  renderRecentDnis();
});

/* -------------------------------------------------------------
   1. NAVEGACIÓN ENTRE SECCIONES
   ------------------------------------------------------------- */
function setupNavigation() {
  dom.navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      switchView(targetId);
    });
  });
}

function switchView(targetId) {
  state.activeView = targetId;

  dom.navBtns.forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-target") === targetId);
  });

  dom.views.forEach((view) => {
    view.classList.toggle("is-active", view.id === targetId);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* -------------------------------------------------------------
   2. MÓDULO DE CONSULTA Y VISUALIZACIÓN DE COMPROBANTES
   ------------------------------------------------------------- */
function setupConsultaModule() {
  dom.inputDniConsulta.addEventListener("input", () => {
    const raw = dom.inputDniConsulta.value;
    dom.btnClearDni.hidden = !raw;
    dom.btnConsultarBajar.disabled = !dniEsConsultable(normalizarDni(raw));
  });

  dom.btnClearDni.addEventListener("click", () => {
    dom.inputDniConsulta.value = "";
    dom.btnClearDni.hidden = true;
    dom.btnConsultarBajar.disabled = true;
    dom.inputDniConsulta.focus();
  });

  dom.formConsulta.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dni = normalizarDni(dom.inputDniConsulta.value);
    if (!dniEsConsultable(dni)) {
      mostrarAlertaConsulta("Por favor, ingresá un DNI válido (entre 6 y 11 dígitos numéricos).", "error");
      return;
    }

    await ejecutarConsultaComprobantes(dni);
  });

  dom.btnExportarExcel.addEventListener("click", exportarAExcel);
  dom.btnExportarJson.addEventListener("click", exportarAJson);

  dom.filtroTexto.addEventListener("input", () => {
    filtrarYRenderizarResultados();
  });

  if (dom.filtroCampanaResultados) {
    dom.filtroCampanaResultados.addEventListener("change", (e) => {
      seleccionarFiltroCampana(e.target.value);
    });
  }

  dom.btnVistaAgrupada.addEventListener("click", () => {
    state.displayMode = "meses";
    dom.btnVistaAgrupada.classList.add("is-active");
    dom.btnVistaTabla.classList.remove("is-active");
    dom.vistaMesesContainer.hidden = false;
    dom.vistaTablaContainer.hidden = true;
  });

  dom.btnVistaTabla.addEventListener("click", () => {
    state.displayMode = "tabla";
    dom.btnVistaTabla.classList.add("is-active");
    dom.btnVistaAgrupada.classList.remove("is-active");
    dom.vistaMesesContainer.hidden = true;
    dom.vistaTablaContainer.hidden = false;
  });
}

async function ejecutarConsultaComprobantes(dni) {
  if (state.isConsulting) return;
  state.isConsulting = true;
  setBotonConsultarCargando(true);
  ocultarAlertaConsulta();
  dom.contenedorResultados.hidden = true;

  try {
    const respuesta = await consultarApi({
      accion: "consultarComprobantes",
      dni: dni
    });

    if (!respuesta || respuesta.ok !== true) {
      const msg = traducirErrorConsulta(respuesta);
      mostrarAlertaConsulta(msg, "error");
      return;
    }

    state.currentDni = dni;
    state.clientName = String(respuesta.cliente || "Cliente Registrado").trim();
    state.comprobantes = Array.isArray(respuesta.comprobantes) ? respuesta.comprobantes : [];

    // Pre-procesar extracción de campaña en cada comprobante
    state.comprobantes.forEach((item) => {
      item._campana = extraerCampanaDeItem(item);
    });

    actualizarSelectorCampanas(state.comprobantes);

    guardarDniReciente(dni, state.clientName);
    renderRecentDnis();

    if (state.comprobantes.length === 0) {
      mostrarAlertaConsulta(`Cliente "${state.clientName}" encontrado, pero aún no tiene comprobantes registrados.`, "info");
      return;
    }

    renderResultados(state.clientName, dni, state.comprobantes);
    mostrarAlertaConsulta(`Listado cargado: se encontraron ${state.comprobantes.length} comprobante(s) de ${state.clientName}.`, "success");

  } catch (error) {
    console.error("Error al consultar comprobantes:", error);
    mostrarAlertaConsulta("No pudimos conectar con el servidor de comprobantes. Verificá tu conexión a internet o intentá nuevamente.", "error");
  } finally {
    state.isConsulting = false;
    setBotonConsultarCargando(false);
  }
}

function renderResultados(nombre, dni, comprobantes) {
  dom.resultadoNombreCliente.textContent = nombre;
  dom.resultadoDniCliente.textContent = formatearDni(dni);
  dom.statTotalComprobantes.textContent = comprobantes.length;
  if (dom.statCampanasActivas) {
    dom.statCampanasActivas.textContent = state.campanasDetectadas.length;
  }

  let totalCentavos = 0;
  const mesesSet = new Set();

  comprobantes.forEach((item) => {
    if (item.fecha) mesesSet.add(item.fecha.slice(0, 7));
    const montoNum = parseMonto(item.monto);
    totalCentavos += montoNum;
  });

  dom.statMontoTotal.textContent = totalCentavos > 0 ? formatearMoneda(totalCentavos) : "$ —";
  dom.statMesesActivos.textContent = mesesSet.size || 1;

  dom.contenedorResultados.hidden = false;
  filtrarYRenderizarResultados();
}

function filtrarYRenderizarResultados() {
  const query = normalizarTexto(dom.filtroTexto.value);
  const campFiltro = state.filtroCampanaResultados || "todas";

  const filtrados = state.comprobantes.filter((item) => {
    // 1. Filtro por Campaña
    if (campFiltro !== "todas") {
      if (campFiltro === "sin_campana") {
        if (item._campana) return false;
      } else {
        if (item._campana !== campFiltro) return false;
      }
    }

    // 2. Filtro por Texto libre (archivo, campaña, tipo, fecha, monto)
    if (!query) return true;
    const texto = normalizarTexto(`${item.nombreArchivo || ""} ${item._campana || ""} ${item.tipo || ""} ${item.fecha || ""} ${item.monto || ""}`);
    return texto.includes(query);
  });

  state.comprobantesFiltrados = filtrados;

  // Actualizar estadísticas dinámicas según filtros activos
  let totalCentavos = 0;
  const mesesSet = new Set();
  filtrados.forEach((item) => {
    if (item.fecha) mesesSet.add(item.fecha.slice(0, 7));
    totalCentavos += parseMonto(item.monto);
  });

  if (campFiltro !== "todas" || query) {
    dom.statTotalComprobantes.textContent = `${filtrados.length} / ${state.comprobantes.length}`;
  } else {
    dom.statTotalComprobantes.textContent = state.comprobantes.length;
  }
  dom.statMontoTotal.textContent = totalCentavos > 0 ? formatearMoneda(totalCentavos) : "$ —";
  dom.statMesesActivos.textContent = mesesSet.size || (filtrados.length ? 1 : 0);

  renderVistaMeses(filtrados);
  renderVistaTabla(filtrados);
}

function renderVistaMeses(comprobantes) {
  if (!comprobantes.length) {
    dom.vistaMesesContainer.innerHTML = `
      <div class="panel-card" style="text-align: center; color: var(--gris-medio);">
        No se encontraron comprobantes que coincidan con la búsqueda.
      </div>
    `;
    return;
  }

  const grupos = {};
  comprobantes.forEach((item) => {
    const clave = item.fecha && /^\d{4}-\d{2}-\d{2}$/.test(item.fecha)
      ? item.fecha.slice(0, 7)
      : "sin-fecha";
    if (!grupos[clave]) {
      grupos[clave] = { titulo: formatoTituloMes(clave), items: [] };
    }
    grupos[clave].items.push(item);
  });

  let html = "";
  for (const clave in grupos) {
    const grupo = grupos[clave];
    html += `
      <section class="month-group">
        <div class="month-group__header">
          <h3 class="month-group__title">${escaparHtml(grupo.titulo)}</h3>
          <span class="month-group__badge">${grupo.items.length} comprobante${grupo.items.length > 1 ? "s" : ""}</span>
        </div>
        <div class="comprobantes-grid">
          ${grupo.items.map(renderTarjetaComprobante).join("")}
        </div>
      </section>
    `;
  }

  dom.vistaMesesContainer.innerHTML = html;
}

function renderTarjetaComprobante(item) {
  const fechaStr = formatearFecha(item.fecha, item.hora);
  const enlace = enlaceSeguro(item.url);
  const monto = item.monto ? String(item.monto).trim() : "—";
  const tipo = item.tipo ? item.tipo : "Transferencia";
  const campana = item._campana || "";

  return `
    <article class="receipt-card">
      <div>
        <div class="receipt-card__top">
          <h4 class="receipt-card__title">${escaparHtml(item.nombreArchivo || "Comprobante de Pago")}</h4>
          <div class="receipt-card__badges">
            ${campana ? `<span class="badge badge--campana">${escaparHtml(campana)}</span>` : ""}
            <span class="badge badge--accent">${escaparHtml(tipo)}</span>
          </div>
        </div>
        <p class="receipt-card__meta">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>${escaparHtml(fechaStr)}</span>
        </p>
        <p class="receipt-card__amount">
          <span>Monto:</span> ${escaparHtml(monto)}
        </p>
      </div>

      <div>
        ${enlace ? `
          <a href="${escaparAtributo(enlace)}" target="_blank" rel="noopener noreferrer" class="btn btn--outline btn--sm receipt-card__btn">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            Abrir Comprobante
          </a>
        ` : `
          <span class="badge" style="background:#E5E7EB; color:#6B7280; width:100%; text-align:center;">Sin enlace digital</span>
        `}
      </div>
    </article>
  `;
}

function renderVistaTabla(comprobantes) {
  if (!comprobantes.length) {
    dom.tablaBody.innerHTML = `<tr><td colspan="6" class="text-center">No hay comprobantes para mostrar.</td></tr>`;
    return;
  }

  dom.tablaBody.innerHTML = comprobantes.map((item) => {
    const fecha = formatearFecha(item.fecha, item.hora);
    const monto = item.monto ? String(item.monto).trim() : "—";
    const enlace = enlaceSeguro(item.url);
    const campana = item._campana || "";

    return `
      <tr>
        <td><strong>${escaparHtml(fecha)}</strong></td>
        <td>${campana ? `<span class="badge badge--campana">${escaparHtml(campana)}</span>` : `<span style="color:var(--gris-medio);">—</span>`}</td>
        <td>${escaparHtml(item.nombreArchivo || "Comprobante")}</td>
        <td><span class="badge badge--accent">${escaparHtml(item.tipo || "Transferencia")}</span></td>
        <td class="text-right"><strong style="color:var(--verde-suave);">${escaparHtml(monto)}</strong></td>
        <td class="text-center">
          ${enlace ? `
            <a href="${escaparAtributo(enlace)}" target="_blank" rel="noopener noreferrer" class="btn btn--outline btn--sm">
              Ver Archivo ↗
            </a>
          ` : `—`}
        </td>
      </tr>
    `;
  }).join("");
}

/* -------------------------------------------------------------
   HELPERS DE FILTRADO POR CAMPAÑA EN CONSULTA
   ------------------------------------------------------------- */
function extraerCampanaDeItem(item) {
  if (!item) return "";
  if (item.campana && typeof item.campana === "string" && item.campana.trim()) {
    let c = item.campana.trim().toUpperCase();
    if (!c.startsWith("C") && /^\d{4}$/.test(c)) c = "C" + c;
    return c;
  }
  const nombre = item.nombreArchivo || item.nombre || "";
  if (!nombre) return "";

  // 1. Quitar timestamp y nombre de cliente inicial si existe (ej: 2026-11-24_09-56_ESTEVEZ-PAOLA-ADRIANA_)
  const sinPrefijo = String(nombre).replace(/^\d{4}-\d{2}-\d{2}[-_]\d{2}[-_]\d{2}[-_][^_]+_/, "");

  // 2. Buscar patrón de campaña en el resto del nombre
  const m1 = sinPrefijo.match(/\b(C\d{4})\b/i);
  if (m1) return m1[1].toUpperCase();

  const m2 = sinPrefijo.match(/^(?:C)?(\d{4})[_\s-]/i);
  if (m2) return "C" + m2[1];

  const m3 = sinPrefijo.match(/[_\s-](?:C)?(\d{4})[_\s-]/i);
  if (m3) return "C" + m3[1];

  // 3. Fallback sobre el nombre completo
  const m4 = String(nombre).match(/_(C?\d{4})[_-]/i);
  if (m4) {
    let c = m4[1].toUpperCase();
    if (!c.startsWith("C")) c = "C" + c;
    return c;
  }

  return "";
}

function actualizarSelectorCampanas(comprobantes) {
  const conteoCampanas = new Map();
  let sinCampana = 0;

  comprobantes.forEach((item) => {
    const c = item._campana || "";
    if (c) {
      conteoCampanas.set(c, (conteoCampanas.get(c) || 0) + 1);
    } else {
      sinCampana++;
    }
  });

  // Guardar lista ordenada descendente (ej: C1326, C1226, C1126...)
  state.campanasDetectadas = Array.from(conteoCampanas.keys()).sort((a, b) => b.localeCompare(a));
  state.filtroCampanaResultados = "todas";

  // 1. Poblar el select
  if (dom.filtroCampanaResultados) {
    let optionsHtml = `<option value="todas">Todas las Campañas (${comprobantes.length})</option>`;
    state.campanasDetectadas.forEach((camp) => {
      const cant = conteoCampanas.get(camp);
      optionsHtml += `<option value="${escaparAtributo(camp)}">Campaña ${escaparHtml(camp)} (${cant})</option>`;
    });
    if (sinCampana > 0) {
      optionsHtml += `<option value="sin_campana">Otras / Sin Campaña (${sinCampana})</option>`;
    }
    dom.filtroCampanaResultados.innerHTML = optionsHtml;
    dom.filtroCampanaResultados.value = "todas";
  }

  // 2. Poblar la barra rápida de pastillas (pills)
  if (dom.quickCampanasBar) {
    if (state.campanasDetectadas.length > 0) {
      let pillsHtml = `
        <span class="campana-pills-bar__label">Filtrar:</span>
        <button type="button" class="campana-pill is-active" data-campana="todas">
          Todas <span class="campana-pill__count">${comprobantes.length}</span>
        </button>
      `;

      state.campanasDetectadas.forEach((camp) => {
        const cant = conteoCampanas.get(camp);
        pillsHtml += `
          <button type="button" class="campana-pill" data-campana="${escaparAtributo(camp)}">
            ${escaparHtml(camp)} <span class="campana-pill__count">${cant}</span>
          </button>
        `;
      });

      if (sinCampana > 0) {
        pillsHtml += `
          <button type="button" class="campana-pill" data-campana="sin_campana">
            Otras <span class="campana-pill__count">${sinCampana}</span>
          </button>
        `;
      }

      dom.quickCampanasBar.innerHTML = pillsHtml;
      dom.quickCampanasBar.hidden = false;

      // Event listeners para las pastillas rápidas
      dom.quickCampanasBar.querySelectorAll(".campana-pill").forEach((btn) => {
        btn.addEventListener("click", () => {
          const val = btn.getAttribute("data-campana") || "todas";
          seleccionarFiltroCampana(val);
        });
      });
    } else {
      dom.quickCampanasBar.hidden = true;
      dom.quickCampanasBar.innerHTML = "";
    }
  }
}

function seleccionarFiltroCampana(valor) {
  state.filtroCampanaResultados = valor;
  if (dom.filtroCampanaResultados && dom.filtroCampanaResultados.value !== valor) {
    dom.filtroCampanaResultados.value = valor;
  }
  if (dom.quickCampanasBar) {
    dom.quickCampanasBar.querySelectorAll(".campana-pill").forEach((btn) => {
      if (btn.getAttribute("data-campana") === valor) {
        btn.classList.add("is-active");
      } else {
        btn.classList.remove("is-active");
      }
    });
  }
  filtrarYRenderizarResultados();
}

/* -------------------------------------------------------------
   3. EXPORTACIÓN DE COMPROBANTES
   ------------------------------------------------------------- */
function exportarAExcel() {
  const lista = state.comprobantesFiltrados && state.comprobantesFiltrados.length
    ? state.comprobantesFiltrados
    : state.comprobantes;
  if (!lista.length) return;

  const filas = [
    ["Cliente", state.clientName],
    ["DNI", state.currentDni],
    ["Campaña", state.filtroCampanaResultados !== "todas" ? state.filtroCampanaResultados : "Todas"],
    ["Fecha de Exportación", new Date().toLocaleString("es-AR")],
    [],
    ["Fecha", "Hora", "Campaña", "Comprobante", "Tipo", "Monto", "Enlace al Archivo"]
  ];

  lista.forEach((item) => {
    filas.push([
      item.fecha || "",
      item.hora || "",
      item._campana || "",
      item.nombreArchivo || "Comprobante",
      item.tipo || "Transferencia",
      item.monto || "",
      item.url || ""
    ]);
  });

  const xml = generarSpreadsheetXml(filas);
  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const sufijoCamp = state.filtroCampanaResultados !== "todas" ? `_${state.filtroCampanaResultados}` : "";
  descargarBlob(blob, `comprobantes_${state.currentDni}${sufijoCamp}_${fechaHoyIso()}.xls`);
}

function exportarAJson() {
  const lista = state.comprobantesFiltrados && state.comprobantesFiltrados.length
    ? state.comprobantesFiltrados
    : state.comprobantes;
  if (!lista.length) return;

  const data = {
    sistema: "Comprobantes Perla Negra SRL",
    cliente: state.clientName,
    dni: state.currentDni,
    campanaFiltrada: state.filtroCampanaResultados,
    exportadoEl: new Date().toISOString(),
    totalComprobantes: lista.length,
    comprobantes: lista
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
  const sufijoCamp = state.filtroCampanaResultados !== "todas" ? `_${state.filtroCampanaResultados}` : "";
  descargarBlob(blob, `comprobantes_${state.currentDni}${sufijoCamp}_${fechaHoyIso()}.json`);
}

function generarSpreadsheetXml(filas) {
  const rowsXml = filas.map((fila) => {
    const cellsXml = fila.map((val) => {
      const text = escaparHtml(String(val || ""));
      return `<Cell><Data ss:Type="String">${text}</Data></Cell>`;
    }).join("");
    return `<Row>${cellsXml}</Row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Comprobantes">
  <Table>
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;
}

function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------
   4. MÓDULO DE CARGA AUTOMÁTICA POR CAMPAÑA (GOOGLE DRIVE)
   ------------------------------------------------------------- */
async function cargarConfiguracionUsuario() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    if (data && data.ok && data.config) {
      if (data.config.nombreUsuario) state.usuarioSubida.nombre = data.config.nombreUsuario;
      state.usuarioSubida.dni = data.config.dniUsuario || "";
    }
  } catch (e) {
    console.warn("No se pudo cargar la configuración de usuario desde el backend:", e);
  }
  renderUsuarioSubida();

  // Si hay DNI configurado, pre-cargar en la casilla de consulta y validar cliente en la web
  if (state.usuarioSubida.dni) {
    if (dom.inputDniConsulta && !dom.inputDniConsulta.value) {
      dom.inputDniConsulta.value = state.usuarioSubida.dni;
      if (dom.btnConsultarBajar) dom.btnConsultarBajar.disabled = false;
    }
    try {
      const verifRes = await fetch(`/api/verificar-cliente?dni=${encodeURIComponent(state.usuarioSubida.dni)}`);
      const verifData = await verifRes.json();
      if (verifData && verifData.ok && verifData.encontrado) {
        state.usuarioSubida.verificadoEnWeb = true;
        state.usuarioSubida.nombreWeb = verifData.vendedor || state.usuarioSubida.nombre;
        renderUsuarioSubida();
      }
    } catch (errVerif) {
      console.warn("No se pudo pre-verificar cliente:", errVerif);
    }
  }
}

function renderUsuarioSubida() {
  const nombre = state.usuarioSubida.nombreWeb || state.usuarioSubida.nombre || "Paola Estévez";
  const dni = state.usuarioSubida.dni || "";
  const verif = state.usuarioSubida.verificadoEnWeb;

  if (dom.navUserNombre) dom.navUserNombre.textContent = nombre;
  if (dom.navUserDniVal) {
    dom.navUserDniVal.textContent = dni ? `DNI: ${dni}` : "DNI: No configurado";
  }

  if (dom.userSubidaNombre) dom.userSubidaNombre.textContent = nombre;
  if (dom.userSubidaDniText) {
    dom.userSubidaDniText.textContent = dni ? (verif ? `DNI: ${dni} ✓ Verificado` : `DNI: ${dni}`) : "DNI: Pendiente en .env";
  }
  if (dom.userSubidaDniBadge) {
    dom.userSubidaDniBadge.className = dni ? (verif ? "badge badge--success" : "badge badge--primary") : "badge badge--warning";
  }

  if (dom.resumenUsuarioNombre) dom.resumenUsuarioNombre.textContent = nombre;
  if (dom.resumenUsuarioDni) {
    dom.resumenUsuarioDni.textContent = dni ? (verif ? `DNI: ${dni} (✓ Cliente activo en web)` : `DNI: ${dni}`) : "DNI: No configurado en .env";
  }
}

function setupCampanaModule() {
  // Cargar usuario configurado en .env y campañas disponibles en Google Drive al inicio
  cargarConfiguracionUsuario();
  cargarCampanasDisponibles();

  // Escanear al hacer clic en el botón
  dom.btnEscanearCampana.addEventListener("click", () => {
    ejecutarEscaneoCampana();
  });

  // Escanear al presionar Enter en el input
  dom.inputCampanaCode.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ejecutarEscaneoCampana();
    }
  });

  // Checkbox maestro: Marcar / Desmarcar comprobantes pendientes del lote visible (hasta 10)
  if (dom.checkMarcarTodos) {
    dom.checkMarcarTodos.addEventListener("change", () => {
      alternarSeleccionarTodos();
    });
  }

  // Botón para Subir Todo (todos los pendientes de la campaña en lotes de 10)
  if (dom.btnSubirTodo) {
    dom.btnSubirTodo.addEventListener("click", async () => {
      await subirComprobantesFaltantes(true);
    });
  }

  // Botón para subir únicamente los comprobantes seleccionados con checkbox
  if (dom.btnSubirFaltantes) {
    dom.btnSubirFaltantes.addEventListener("click", async () => {
      await subirComprobantesFaltantes(false);
    });
  }

  // Botón para exportar comprobantes de la campaña a Excel
  if (dom.btnGenerarExcelCampana) {
    dom.btnGenerarExcelCampana.addEventListener("click", async () => {
      const campana = state.currentCampanaData && state.currentCampanaData.campana
        ? state.currentCampanaData.campana
        : (dom.inputCampanaCode.value || "").toUpperCase().trim();

      if (!campana || !/^C\d{4}$/.test(campana)) {
        alert("Por favor ingresá o escaneá una campaña válida (ej: C1026).");
        return;
      }

      dom.btnGenerarExcelCampana.classList.add("is-loading");
      dom.btnGenerarExcelCampana.disabled = true;

      try {
        const res = await fetch(`/api/generar-excel?campana=${campana}`);
        const data = await res.json();
        if (data.ok) {
          window.location.href = `/api/descargar-excel?campana=${campana}`;
        } else {
          alert("Error generando Excel: " + (data.error || "Desconocido"));
        }
      } catch (e) {
        alert("Error de conexión al generar Excel: " + e.message);
      } finally {
        dom.btnGenerarExcelCampana.classList.remove("is-loading");
        dom.btnGenerarExcelCampana.disabled = false;
      }
    });
  }

  // Filtro de búsqueda en la tabla de campaña
  dom.filtroArchivosCampana.addEventListener("input", () => {
    state.loteActual = 1;
    renderLotesPills();
    renderTablaArchivosCampana();
  });

  // Tabs de filtro: Todos / Faltantes / Ya Subidos
  dom.filtroTabTodos.addEventListener("click", () => {
    cambiarTabFiltroCampana("todos", dom.filtroTabTodos);
  });
  dom.filtroTabFaltantes.addEventListener("click", () => {
    cambiarTabFiltroCampana("faltantes", dom.filtroTabFaltantes);
  });
  dom.filtroTabSubidos.addEventListener("click", () => {
    cambiarTabFiltroCampana("subidos", dom.filtroTabSubidos);
  });

  // Tabs de filtro de Destinatario: Todos / Solo Empresa / No Empresa
  if (dom.filtroDestTodos) {
    dom.filtroDestTodos.addEventListener("click", () => {
      cambiarTabFiltroDestinatario("todos", dom.filtroDestTodos);
    });
  }
  if (dom.filtroDestEmpresa) {
    dom.filtroDestEmpresa.addEventListener("click", () => {
      cambiarTabFiltroDestinatario("empresa", dom.filtroDestEmpresa);
    });
  }
  if (dom.filtroDestNoEmpresa) {
    dom.filtroDestNoEmpresa.addEventListener("click", () => {
      cambiarTabFiltroDestinatario("no_empresa", dom.filtroDestNoEmpresa);
    });
  }

  // Botón "Marcar 10 Pendientes"
  if (dom.btnSeleccionar10) {
    dom.btnSeleccionar10.addEventListener("click", () => {
      seleccionarSiguientes10Pendientes();
    });
  }

  // Ordenamiento por Nombre del Archivo
  if (dom.thSortNombre) {
    dom.thSortNombre.addEventListener("click", () => {
      alternarOrdenCampana("nombre");
    });
  }

  // Ordenamiento por Cliente
  if (dom.btnSortCliente) {
    dom.btnSortCliente.addEventListener("click", (e) => {
      e.stopPropagation();
      alternarOrdenCampana("cliente");
    });
  }

  // Ordenamiento por Importe
  if (dom.btnSortMonto) {
    dom.btnSortMonto.addEventListener("click", (e) => {
      e.stopPropagation();
      alternarOrdenCampana("monto");
    });
  }
}

/**
 * Alterna el campo o la dirección de ordenamiento
 */
function alternarOrdenCampana(campo) {
  if (state.ordenCampana.campo === campo) {
    state.ordenCampana.direccion = state.ordenCampana.direccion === "asc" ? "desc" : "asc";
  } else {
    state.ordenCampana.campo = campo;
    state.ordenCampana.direccion = "asc";
  }
  actualizarIndicadoresOrden();
  renderLotesPills();
  renderTablaArchivosCampana();
}

/**
 * Actualiza los íconos de orden (▲, ▼, ⇅) y estados visuales en los encabezados
 */
function actualizarIndicadoresOrden() {
  const { campo, direccion } = state.ordenCampana;
  const iconoAsc = "▲";
  const iconoDesc = "▼";
  const iconoNeutro = "⇅";

  if (dom.sortIndNombre) {
    dom.sortIndNombre.textContent = campo === "nombre" ? (direccion === "asc" ? iconoAsc : iconoDesc) : iconoNeutro;
    dom.sortIndNombre.className = `sort-indicator ${campo === "nombre" ? "sort-indicator--active" : ""}`;
  }

  if (dom.btnSortCliente && dom.sortIndCliente) {
    const esActivo = campo === "cliente";
    dom.btnSortCliente.classList.toggle("is-active", esActivo);
    dom.sortIndCliente.textContent = esActivo ? (direccion === "asc" ? iconoAsc : iconoDesc) : iconoNeutro;
    dom.sortIndCliente.className = `sort-indicator ${esActivo ? "sort-indicator--active" : ""}`;
  }

  if (dom.btnSortMonto && dom.sortIndMonto) {
    const esActivo = campo === "monto";
    dom.btnSortMonto.classList.toggle("is-active", esActivo);
    dom.sortIndMonto.textContent = esActivo ? (direccion === "asc" ? iconoAsc : iconoDesc) : iconoNeutro;
    dom.sortIndMonto.className = `sort-indicator ${esActivo ? "sort-indicator--active" : ""}`;
  }
}

/**
 * Retorna todos los archivos filtrados por búsqueda y tab, ordenados según la configuración activa
 */
function getTodosArchivosFiltradosYSort() {
  if (!state.campanaData || !state.campanaData.archivos) return [];
  const query = normalizarTexto(dom.filtroArchivosCampana ? dom.filtroArchivosCampana.value : "");
  const tab = state.filtroCampanaTab;
  const destTab = state.filtroDestinatarioTab;

  let filtrados = state.campanaData.archivos.filter(item => {
    if (tab === "faltantes" && item.estado !== "PENDIENTE") return false;
    if (tab === "subidos" && item.estado !== "SUBIDO") return false;

    // Filtro por destinatario (PARA: Empresa vs No Empresa)
    const isEmp = esDestinoEmpresa(item);
    if (destTab === "empresa" && !isEmp) return false;
    if (destTab === "no_empresa" && isEmp) return false;

    if (!query) return true;
    const searchString = normalizarTexto(`${item.nombre} ${item.cliente || ""} ${item.monto || ""} ${item.destinatario || ""} ${item.origen || ""}`);
    return searchString.includes(query);
  });

  // Ordenamiento por campo y dirección
  const { campo, direccion } = state.ordenCampana;

  filtrados.sort((a, b) => {
    let cmp = 0;
    if (campo === "nombre") {
      cmp = a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: "base" });
    } else if (campo === "cliente") {
      const ca = (a.cliente || "").trim();
      const cb = (b.cliente || "").trim();
      cmp = ca.localeCompare(cb, undefined, { sensitivity: "base" });
    } else if (campo === "monto") {
      const ma = normalizarMonto(a.monto) || 0;
      const mb = normalizarMonto(b.monto) || 0;
      cmp = ma - mb;
    }
    return direccion === "asc" ? cmp : -cmp;
  });

  return filtrados;
}

/**
 * Obtiene los archivos que deben verse en la tabla según el bloque activo o todos
 */
function getArchivosVisibles() {
  const todos = getTodosArchivosFiltradosYSort();
  if (!state.loteActual || state.loteActual === 0) return todos;
  const inicio = (state.loteActual - 1) * state.tamanoLote;
  return todos.slice(inicio, inicio + state.tamanoLote);
}

/**
 * Renderiza los botones de bloques (lotes de hasta 10 comprobantes)
 */
function renderLotesPills() {
  if (!dom.lotesPillsList) return;
  if (!state.campanaData || !state.campanaData.archivos) {
    if (dom.lotesBar) dom.lotesBar.style.display = "none";
    return;
  }
  const todos = getTodosArchivosFiltradosYSort();
  const total = todos.length;
  if (total === 0) {
    if (dom.lotesBar) dom.lotesBar.style.display = "none";
    return;
  }
  if (dom.lotesBar) dom.lotesBar.style.display = "flex";

  const numLotes = Math.ceil(total / state.tamanoLote);
  let html = "";
  for (let i = 1; i <= numLotes; i++) {
    const inicio = (i - 1) * state.tamanoLote;
    const fin = Math.min(inicio + state.tamanoLote, total);
    const slice = todos.slice(inicio, fin);
    const pendientesEmpresa = slice.filter(a => a.estado === "PENDIENTE" && esDestinoEmpresa(a)).length;
    const noEmpresaPend = slice.filter(a => a.estado === "PENDIENTE" && !esDestinoEmpresa(a)).length;
    const esActivo = state.loteActual === i;
    const esCompleto = pendientesEmpresa === 0;

    const badgeLabel = esCompleto ? (noEmpresaPend > 0 ? `⚠️ ${noEmpresaPend} no emp.` : "✓") : `${pendientesEmpresa} pend.`;

    html += `
      <button type="button" class="lote-pill ${esActivo ? "is-active" : ""} ${esCompleto ? "is-complete" : ""}" onclick="window.seleccionarLote(${i})" title="Bloque ${i}: comprobantes ${inicio + 1} a ${fin}">
        Bloque ${i} <span class="lote-pill__badge">${badgeLabel}</span>
      </button>
    `;
  }

  // Opción "Ver Todos"
  html += `
    <button type="button" class="lote-pill ${state.loteActual === 0 ? "is-active" : ""}" onclick="window.seleccionarLote(0)" title="Ver todos los comprobantes">
      Ver Todos <span class="lote-pill__badge">${total}</span>
    </button>
  `;

  dom.lotesPillsList.innerHTML = html;
}

window.seleccionarLote = function (k) {
  state.loteActual = k;
  renderLotesPills();

  // Si el usuario cambia de bloque, auto-seleccionamos los pendientes de este bloque QUE SEAN PARA EMPRESA (máx. 10)
  const visiblesPendientesEmpresa = getArchivosVisibles().filter(a => a.estado === "PENDIENTE" && esDestinoEmpresa(a));
  state.selectedFiles.clear();
  visiblesPendientesEmpresa.slice(0, state.tamanoLote).forEach(a => state.selectedFiles.add(a.nombre));

  renderTablaArchivosCampana();
  actualizarEstadoBotonSubir();
};

/**
 * Selecciona los primeros 10 comprobantes pendientes dondequiera que estén (excluyendo los que no sean para Empresa)
 */
function seleccionarSiguientes10Pendientes() {
  if (!state.campanaData || !state.campanaData.archivos) return;
  const todos = getTodosArchivosFiltradosYSort();
  const pendientesEmpresa = todos.filter(a => a.estado === "PENDIENTE" && esDestinoEmpresa(a));

  if (!pendientesEmpresa.length) {
    mostrarAlertaCampana("No quedan comprobantes pendientes para Empresa por subir.", "info");
    return;
  }

  state.selectedFiles.clear();
  const diez = pendientesEmpresa.slice(0, state.tamanoLote);
  diez.forEach(a => state.selectedFiles.add(a.nombre));

  // Ajustar bloque activo al bloque que contiene el primer archivo pendiente
  const primerIdx = todos.findIndex(a => a.nombre === diez[0].nombre);
  if (primerIdx !== -1 && state.loteActual !== 0) {
    state.loteActual = Math.floor(primerIdx / state.tamanoLote) + 1;
  }

  renderLotesPills();
  renderTablaArchivosCampana();
  actualizarEstadoBotonSubir();
  mostrarAlertaCampana(`Se seleccionaron ${diez.length} comprobantes pendientes para Empresa (máximo de 10 por bloque).`, "info");
}

function alternarSeleccionarTodos() {
  if (!state.campanaData || !state.campanaData.archivos) return;

  const marcar = dom.checkMarcarTodos.checked;
  const visiblesPendientes = getArchivosVisibles().filter(a => a.estado === "PENDIENTE");
  const visiblesPendientesEmpresa = visiblesPendientes.filter(a => esDestinoEmpresa(a));
  const noEmpresaCount = visiblesPendientes.length - visiblesPendientesEmpresa.length;

  if (!marcar) {
    visiblesPendientes.forEach(item => state.selectedFiles.delete(item.nombre));
  } else {
    // Respetar límite seguro de hasta 10 comprobantes y que sean para Empresa
    state.selectedFiles.clear();
    const aMarcar = visiblesPendientesEmpresa.slice(0, state.tamanoLote);
    aMarcar.forEach(item => state.selectedFiles.add(item.nombre));
    if (noEmpresaCount > 0) {
      mostrarAlertaCampana(`Se seleccionaron ${aMarcar.length} comprobantes para Empresa. Se excluyeron ${noEmpresaCount} comprobante(s) por no tener destino Empresa.`, "info");
    } else if (visiblesPendientesEmpresa.length > state.tamanoLote) {
      mostrarAlertaCampana(`Se seleccionaron los primeros 10 comprobantes para respetar el límite de seguridad por bloque.`, "info");
    }
  }

  renderTablaArchivosCampana();
  actualizarEstadoBotonSubir();
}

function actualizarEstadoBotonSubir() {
  if (!state.campanaData) return;

  const seleccionadosPendientes = state.campanaData.archivos.filter(
    a => a.estado === "PENDIENTE" && state.selectedFiles.has(a.nombre)
  );

  const cantSeleccionados = seleccionadosPendientes.length;
  const pendientesTotalesEmpresa = state.campanaData.archivos.filter(
    a => a.estado === "PENDIENTE" && esDestinoEmpresa(a)
  ).length;

  // 1. Botón "Subir Todo" (en bloques de 10 con pausas preventivas)
  if (dom.btnSubirTodo) {
    dom.btnSubirTodo.disabled = pendientesTotalesEmpresa === 0 || state.isUploadingBatch;
    if (dom.labelSubirTodo) {
      if (pendientesTotalesEmpresa > 0) {
        dom.labelSubirTodo.textContent = `Subir Todo (${pendientesTotalesEmpresa} Empresa en bloques de 10)`;
      } else {
        dom.labelSubirTodo.textContent = "Todos los de Empresa subidos ✓";
      }
    }
  }

  // 2. Botón "Subir Bloque Seleccionado" (hasta 10)
  if (dom.btnSubirFaltantes) {
    if (cantSeleccionados > 0) {
      dom.btnSubirFaltantes.style.display = "inline-flex";
      dom.btnSubirFaltantes.disabled = state.isUploadingBatch;
      if (dom.labelSubirSeleccionados) {
        dom.labelSubirSeleccionados.textContent = `Subir Bloque (${cantSeleccionados} comprobante${cantSeleccionados > 1 ? "s" : ""})`;
      }
    } else {
      dom.btnSubirFaltantes.style.display = "none";
    }
  }

  // Actualizar checkbox maestro
  if (dom.checkMarcarTodos) {
    const visiblesPendientes = getArchivosVisibles().filter(a => a.estado === "PENDIENTE");
    if (visiblesPendientes.length === 0) {
      dom.checkMarcarTodos.checked = false;
      dom.checkMarcarTodos.indeterminate = false;
      dom.checkMarcarTodos.disabled = true;
    } else {
      dom.checkMarcarTodos.disabled = false;
      const cantMarcadosVisibles = visiblesPendientes.filter(a => state.selectedFiles.has(a.nombre)).length;
      if (cantMarcadosVisibles === visiblesPendientes.length && cantMarcadosVisibles > 0) {
        dom.checkMarcarTodos.checked = true;
        dom.checkMarcarTodos.indeterminate = false;
      } else if (cantMarcadosVisibles > 0) {
        dom.checkMarcarTodos.checked = false;
        dom.checkMarcarTodos.indeterminate = true;
      } else {
        dom.checkMarcarTodos.checked = false;
        dom.checkMarcarTodos.indeterminate = false;
      }
    }
  }
}

function cambiarTabFiltroCampana(tipo, btnActivo) {
  state.filtroCampanaTab = tipo;
  state.loteActual = 1;
  [dom.filtroTabTodos, dom.filtroTabFaltantes, dom.filtroTabSubidos].forEach(b => {
    if (b) b.classList.remove("is-active");
  });
  if (btnActivo) btnActivo.classList.add("is-active");
  renderLotesPills();
  renderTablaArchivosCampana();
  actualizarEstadoBotonSubir();
}

function cambiarTabFiltroDestinatario(tipo, btnActivo) {
  state.filtroDestinatarioTab = tipo;
  state.loteActual = 1;
  [dom.filtroDestTodos, dom.filtroDestEmpresa, dom.filtroDestNoEmpresa].forEach(b => {
    if (b) b.classList.remove("is-active");
  });
  if (btnActivo) btnActivo.classList.add("is-active");
  renderLotesPills();
  renderTablaArchivosCampana();
  actualizarEstadoBotonSubir();
}

/**
 * Determina si el comprobante está destinado a la Empresa (Perla Negra)
 */
function esDestinoEmpresa(item) {
  if (!item) return false;
  const rawDest = String(item.destinatario || "").trim();
  if (!rawDest) return false;
  return /perla\s*negra/i.test(rawDest) || rawDest.toLowerCase() === "empresa";
}

async function toggleDestinatarioManual(nombreArchivo, nuevoDest) {
  try {
    const res = await fetch("/api/actualizar-destinatario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archivo: nombreArchivo, destinatario: nuevoDest })
    });
    const data = await res.json();
    if (!data.ok) {
      alert("Error al actualizar destinatario: " + (data.error || "desconocido"));
      return;
    }
    // Actualizar en el estado local
    if (state.campanaData && state.campanaData.archivos) {
      const item = state.campanaData.archivos.find(a => a.nombre === nombreArchivo);
      if (item) {
        item.destinatario = nuevoDest;
      }
      renderTablaCampana();
      renderLotesBar();
    }
  } catch (err) {
    console.error("Error al actualizar destinatario:", err);
  }
}
window.toggleDestinatarioManual = toggleDestinatarioManual;

/**
 * Consulta a la API local de Node las campañas detectadas en Google Drive
 */
async function cargarCampanasDisponibles() {
  try {
    const res = await fetch("/api/campanas");
    const data = await res.json();

    if (data && data.ok && Array.isArray(data.campanas) && data.campanas.length) {
      dom.campanasTagsList.innerHTML = data.campanas.map((c) => `
        <button type="button" class="tag-btn" onclick="window.seleccionarCampanaRapida('${c.codigo}')">
          📁 ${c.codigo}
        </button>
      `).join("");
      
      if (data.basePath && dom.driveBasePathDisplay) {
        dom.driveBasePathDisplay.textContent = `📁 Drive: ${data.basePath}`;
      }
    } else {
      dom.campanasTagsList.innerHTML = `<span style="font-size:0.8rem; color:var(--gris-medio);">No se detectaron carpetas de campaña en ${data.basePath || "Drive"}.</span>`;
    }
  } catch (err) {
    console.warn("Servidor API local no disponible o cargado en modo estático:", err);
    dom.campanasTagsList.innerHTML = `
      <button type="button" class="tag-btn" onclick="window.seleccionarCampanaRapida('C1026')">📁 C1026</button>
      <button type="button" class="tag-btn" onclick="window.seleccionarCampanaRapida('C0926')">📁 C0926</button>
    `;
  }
}

window.seleccionarCampanaRapida = function (codigo) {
  dom.inputCampanaCode.value = codigo;
  ejecutarEscaneoCampana();
};

/**
 * Escanea la carpeta correspondiente a la campaña ingresada
 */
async function ejecutarEscaneoCampana() {
  const rawCode = dom.inputCampanaCode.value.trim().toUpperCase();
  if (!rawCode) {
    mostrarAlertaCampana("Ingresá un código de campaña con formato CnnAA (ej: C1026 o C1326).", "error");
    dom.inputCampanaCode.focus();
    return;
  }

  if (!/^C\d{4}$/.test(rawCode)) {
    mostrarAlertaCampana(`El formato "${rawCode}" no es válido. Debe comenzar con C seguido de 2 dígitos de campaña y 2 de año (ej: C1026 o C1326).`, "error");
    return;
  }

  state.isScanning = true;
  dom.btnEscanearCampana.classList.add("is-loading");
  dom.btnEscanearCampana.disabled = true;
  ocultarAlertaCampana();
  dom.contenedorResultadoCampana.hidden = true;

  try {
    const res = await fetch(`/api/escanear-campana?campana=${rawCode}`);
    const data = await res.json();

    if (!data || !data.ok) {
      mostrarAlertaCampana(data.error || `No se pudo escanear la campaña ${rawCode}.`, "error");
      return;
    }

    state.campanaActual = rawCode;
    state.campanaData = data;
    state.loteActual = 1;

    renderResumenCampana(data);
    seleccionarSiguientes10Pendientes();
    mostrarAlertaCampana(`Campaña ${rawCode}: ${data.totalArchivos} comprobantes encontrados. ${data.totalSubidos} ya registrados, ${data.totalPendientes} pendientes de subir. Lote 1 (10 comprobantes) seleccionado para subir.`, "info");

  } catch (err) {
    console.error("Error al escanear campaña:", err);
    mostrarAlertaCampana("Error al comunicarse con el servidor local para escanear la carpeta de Google Drive.", "error");
  } finally {
    state.isScanning = false;
    dom.btnEscanearCampana.classList.remove("is-loading");
    dom.btnEscanearCampana.disabled = false;
  }
}

function renderResumenCampana(data) {
  dom.resumenCampanaCodigo.textContent = data.campana;
  dom.resumenCampanaCarpeta.textContent = `Carpeta: ${data.carpeta}`;

  if (dom.resumenUsuarioNombre) dom.resumenUsuarioNombre.textContent = state.usuarioSubida.nombre || "Paola Estévez";
  if (dom.resumenUsuarioDni) dom.resumenUsuarioDni.textContent = state.usuarioSubida.dni ? `DNI: ${state.usuarioSubida.dni}` : "DNI: No configurado en .env";

  dom.statCampanaTotal.textContent = data.totalArchivos;
  dom.statCampanaSubidos.textContent = data.totalSubidos;
  dom.statCampanaFaltantes.textContent = data.totalPendientes;

  // Actualizar badges en los tabs de filtro
  dom.countBadgeTodos.textContent = data.totalArchivos;
  dom.countBadgeFaltantes.textContent = data.totalPendientes;
  dom.countBadgeSubidos.textContent = data.totalSubidos;

  // Actualizar badges en los tabs de filtro de Destinatario (PARA)
  if (data.archivos) {
    const totalArchivos = data.archivos.length;
    const countEmpresa = data.archivos.filter(a => esDestinoEmpresa(a)).length;
    const countNoEmpresa = totalArchivos - countEmpresa;

    if (dom.countDestTodos) dom.countDestTodos.textContent = totalArchivos;
    if (dom.countDestEmpresa) dom.countDestEmpresa.textContent = countEmpresa;
    if (dom.countDestNoEmpresa) dom.countDestNoEmpresa.textContent = countNoEmpresa;
  }

  dom.contenedorResultadoCampana.hidden = false;
  actualizarIndicadoresOrden();
  renderLotesPills();
  renderTablaArchivosCampana();
  actualizarEstadoBotonSubir();
}

function renderTablaArchivosCampana() {
  if (!state.campanaData || !state.campanaData.archivos) return;

  const filtrados = getArchivosVisibles();

  if (!filtrados.length) {
    dom.tablaArchivosCampanaBody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 2rem; color: var(--gris-medio);">No hay archivos para el filtro seleccionado.</td></tr>`;
    actualizarEstadoBotonSubir();
    return;
  }

  dom.tablaArchivosCampanaBody.innerHTML = filtrados.map(item => {
    const isSubido = item.estado === "SUBIDO";
    const isError = item.estado === "ERROR" || item.estado === "FALLIDO";
    const isChecked = !isSubido && state.selectedFiles.has(item.nombre);
    const isEmpresa = esDestinoEmpresa(item);
    const rowClass = isSubido ? "row--subido" : (isChecked ? "row--selected" : (!isEmpresa ? "row--no-empresa" : ""));
    const ext = (item.nombre.split(".").pop() || "").toLowerCase();
    const isPdf = ext === "pdf";

    const urlPreview = `/api/comprobante-preview?campana=${encodeURIComponent(state.campanaActual)}&archivo=${encodeURIComponent(item.nombre)}`;

    // Casilla de la fila: desactivada en gris si ya está subido, interactiva si está pendiente
    const checkboxHtml = isSubido
      ? `<input type="checkbox" class="form-checkbox" disabled title="Comprobante ya subido al sistema" />`
      : `<input type="checkbox" class="form-checkbox check-archivo-item" data-nombre="${escaparAtributo(item.nombre)}" ${isChecked ? "checked" : ""} onchange="window.toggleSeleccionArchivo('${escaparAtributo(item.nombre)}', this.checked)" title="${isEmpresa ? 'Seleccionar para subir' : 'Atención: Destino NO es Empresa (en principio NO enviar)'}" />`;

    // Miniatura (Imagen) o ícono PDF
    const imagenHtml = isPdf
      ? `<a href="${urlPreview}" target="_blank" rel="noopener noreferrer" class="receipt-thumb-pdf" title="Abrir PDF en pantalla completa">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          <span>PDF</span>
        </a>`
      : `<a href="${urlPreview}" target="_blank" rel="noopener noreferrer" title="Clic para ver comprobante completo">
          <img src="${urlPreview}" alt="${escaparAtributo(item.nombre)}" class="receipt-thumb" loading="lazy" onerror="this.parentElement.innerHTML='<span style=\\'font-size:0.7rem;color:#94A3B8;\\'>DOC</span>'" />
        </a>`;

    // Destinatario leído del comprobante ("Cuenta destino" o "Para")
    // Cualquier variante de Perla Negra SRL se unifica como "Empresa"
    const dest = isEmpresa ? "Empresa" : (item.destinatario || "No identificado");
    const destClase = isEmpresa ? "dest-perla" : "dest-no-empresa";

    // Comprobación de importe (soporta tanto C1126 como 1126 sin la C):
    const matchNombre = item.nombre.match(/^[a-zA-Z]?\d{4}\s+([\d.]+)/i);
    const montoNombre = matchNombre ? normalizarMonto(matchNombre[1]) : normalizarMonto(item.monto);
    const montoDoc = (item.montoDoc !== undefined && item.montoDoc !== null) ? normalizarMonto(item.montoDoc) : null;

    // Solo se considera discrepancia si AMBOS importes fueron leídos y son numéricamente diferentes
    // (ej: si el nombre dice 6000 y el comprobante pone 6.000, ambos se normalizan a 6000 y coinciden)
    const hayDiscrepanciaReal = Boolean(
      montoNombre !== null &&
      montoDoc !== null &&
      montoNombre !== montoDoc
    );

    const claseTitulo = hayDiscrepanciaReal ? "receipt-file-title--mismatch" : "";
    const colorTitulo = hayDiscrepanciaReal 
      ? "#DC2626" 
      : (isSubido ? "#6B7280" : "var(--azul-kaizuna)");

    let motivoTooltip = "Importe correcto";
    if (hayDiscrepanciaReal) {
      motivoTooltip = `⚠️ Discrepancia real: El nombre dice $${montoNombre} pero el comprobante dice $${montoDoc}.`;
    } else if (montoNombre) {
      motivoTooltip = `Importe: $${montoNombre}`;
    }

    // Estado con inicial única y color: P (naranja), E (verde), F (rojo)
    let badgeEstadoHtml = "";
    if (isSubido) {
      badgeEstadoHtml = `<span class="status-badge-initial status-badge--E" title="E: Enviado / Ya subido">E</span>`;
    } else if (isError) {
      badgeEstadoHtml = `<span class="status-badge-initial status-badge--F" title="F: Fallido / Error al subir">F</span>`;
    } else {
      badgeEstadoHtml = `<span class="status-badge-initial status-badge--P" title="P: Pendiente de subir">P</span>`;
    }

    return `
      <tr class="${rowClass}">
        <td class="text-center" style="width: 44px;">
          ${checkboxHtml}
        </td>
        <td>
          <div>
            <span class="${claseTitulo}" style="color: ${colorTitulo}; font-weight: 600; font-size: 0.92rem;" title="${escaparAtributo(motivoTooltip)}">
              ${escaparHtml(item.nombre)}
            </span>
            ${hayDiscrepanciaReal ? `<span class="mismatch-badge" title="${escaparAtributo(motivoTooltip)}">⚠️ Importe</span>` : ''}
          </div>
          <div class="receipt-file-destinatario">
            <span class="destinatario-label">DESDE:</span>
            <span class="origen-val" title="${escaparAtributo(item.origen || 'No identificado')}">${escaparHtml(item.origen || 'No identificado')}</span>
            <span class="destinatario-divider">•</span>
            <span class="destinatario-label">PARA:</span>
            <span class="destinatario-val ${destClase}" title="${escaparAtributo(dest)}">
              ${escaparHtml(dest)} ${!isEmpresa ? "⚠️" : ""}
            </span>
            ${!isEmpresa ? `
              <span class="badge-no-empresa" title="Destino NO es Empresa. En principio NO debe enviarse.">⚠️ No Empresa</span>
              <button type="button" class="btn-toggle-dest" title="Marcar manualmente como Empresa si verificaste que corresponde a Perla Negra" onclick="toggleDestinatarioManual('${escaparAtributo(item.nombre)}', 'Empresa')">Marcar Empresa ✓</button>
            ` : `
              <button type="button" class="btn-toggle-dest btn-toggle-dest--revert" title="Desmarcar Empresa si el pago no correspondía a Perla Negra" onclick="toggleDestinatarioManual('${escaparAtributo(item.nombre)}', 'No identificado')">↺ Desmarcar</button>
            `}
          </div>
        </td>
        <td>
          <div style="font-weight: 500;">${escaparHtml(item.cliente || "—")}</div>
          ${item.monto ? `<div class="receipt-amount">$ ${escaparHtml(item.monto)}</div>` : ""}
        </td>
        <td class="text-center" style="width: 80px;">
          <div class="receipt-thumb-wrap">
            ${imagenHtml}
          </div>
        </td>
        <td class="text-center" style="width: 70px;">
          ${badgeEstadoHtml}
        </td>
      </tr>
    `;
  }).join("");

  actualizarEstadoBotonSubir();
}

window.toggleSeleccionArchivo = function (nombre, checked) {
  if (checked) {
    if (state.selectedFiles.size >= state.tamanoLote) {
      mostrarAlertaCampana(`Solo podés seleccionar hasta ${state.tamanoLote} comprobantes por bloque para evitar saturar el servidor.`, "warning");
      const cb = document.querySelector(`.check-archivo-item[data-nombre="${CSS.escape(nombre)}"]`);
      if (cb) cb.checked = false;
      return;
    }
    state.selectedFiles.add(nombre);

    const item = state.campanaData?.archivos?.find(a => a.nombre === nombre);
    if (item && !esDestinoEmpresa(item)) {
      mostrarAlertaCampana(`⚠️ Advertencia: Seleccionaste "${nombre}" cuyo destino no es Empresa ("${item.destinatario || 'No identificado'}"). Recordá que los que no van a Empresa en principio no deben enviarse.`, "warning");
    }
  } else {
    state.selectedFiles.delete(nombre);
  }

  // Reflejar cambio de fila seleccionada sin re-renderizar todo
  const tr = document.querySelector(`.check-archivo-item[data-nombre="${CSS.escape(nombre)}"]`)?.closest("tr");
  if (tr) {
    tr.classList.toggle("row--selected", checked);
  }

  actualizarEstadoBotonSubir();
};

/**
 * Procesa y sube comprobantes pendientes en bloques de hasta 10,
 * validando el DNI una sola vez para el bloque y aplicando pausas preventivas
 * para evitar saturar el servidor de Google Apps Script.
 * @param {boolean} forzarTodo Si es true, procesa todos los bloques pendientes de la campaña
 */
async function subirComprobantesFaltantes(forzarTodo = false) {
  if (!state.campanaData || state.isUploadingBatch) return;

  let aSubir = [];
  if (!forzarTodo && state.selectedFiles.size > 0) {
    aSubir = state.campanaData.archivos.filter(
      a => a.estado === "PENDIENTE" && state.selectedFiles.has(a.nombre)
    );
  } else {
    // Si estamos viendo un bloque específico (ej: Bloque 1) y no se presiona "Subir Todo", subir los pendientes de ese bloque QUE SEAN PARA EMPRESA
    if (!forzarTodo && state.loteActual > 0) {
      aSubir = getArchivosVisibles().filter(a => a.estado === "PENDIENTE" && esDestinoEmpresa(a));
    } else {
      // Subir Todo: todos los comprobantes pendientes de la campaña cuyo destino SEA Empresa
      aSubir = state.campanaData.archivos.filter(a => a.estado === "PENDIENTE" && esDestinoEmpresa(a));
    }
  }

  const omitidosNoEmpresa = state.campanaData.archivos.filter(a => a.estado === "PENDIENTE" && !esDestinoEmpresa(a)).length;

  if (!aSubir.length) {
    if (omitidosNoEmpresa > 0) {
      mostrarAlertaCampana(`No quedan comprobantes pendientes para Empresa por subir. Hay ${omitidosNoEmpresa} comprobante(s) pendiente(s) pero su destino NO es Empresa (están en ROJO y no deben enviarse).`, "warning");
    } else {
      mostrarAlertaCampana("No quedan comprobantes pendientes por subir en este bloque o campaña.", "info");
    }
    return;
  }

  // 1. Verificar si el DNI del usuario está configurado en .env
  const dni = (state.usuarioSubida.dni || "").replace(/[\s.\-_/\\,]/g, "").trim();
  if (!dni) {
    mostrarAlertaCampana(`⚠️ Falta configurar DNI_USUARIO en el archivo .env para el usuario ${state.usuarioSubida.nombre || "Paola Estévez"}. Editá el .env con el número de DNI y volvé a presionar Subir.`, "warning");
    return;
  }

  state.isUploadingBatch = true;
  if (dom.btnSubirTodo) {
    dom.btnSubirTodo.disabled = true;
    dom.btnSubirTodo.classList.add("is-loading");
  }
  if (dom.btnSubirFaltantes) {
    dom.btnSubirFaltantes.disabled = true;
    dom.btnSubirFaltantes.classList.add("is-loading");
  }
  dom.progresoSubidaCard.hidden = false;

  // 2. VERIFICACIÓN ÚNICA DEL DNI (igual que en catalogoperlanegra.com.ar/comprobantes)
  dom.progresoTitulo.textContent = `Validando DNI ${dni} en la web central...`;
  dom.progresoPorcentaje.textContent = `...`;
  dom.progresoArchivoActual.textContent = `Poniendo el DNI una sola vez para autorizar la subida del bloque...`;

  let clienteNombreVerificado = state.usuarioSubida.nombre || "Paola Estévez";
  try {
    const verifRes = await fetch(`/api/verificar-cliente?dni=${encodeURIComponent(dni)}`);
    const verifData = await verifRes.json();
    if (verifData && verifData.ok && verifData.encontrado) {
      clienteNombreVerificado = verifData.vendedor || clienteNombreVerificado;
      state.usuarioSubida.nombreWeb = clienteNombreVerificado;
      state.usuarioSubida.verificadoEnWeb = true;
      renderUsuarioSubida();
    } else if (verifData && verifData.codigo === "no_encontrado") {
      dom.progresoSubidaCard.hidden = true;
      state.isUploadingBatch = false;
      if (dom.btnSubirTodo) dom.btnSubirTodo.classList.remove("is-loading");
      if (dom.btnSubirFaltantes) dom.btnSubirFaltantes.classList.remove("is-loading");
      mostrarAlertaCampana(`⚠️ El DNI ${dni} no figura en el padrón web de Perla Negra. Verificalo en el archivo .env`, "warning");
      return;
    }
  } catch (e) {
    console.warn("Verificación previa de DNI omitida por red:", e);
  }

  const total = aSubir.length;
  let exitosos = 0;
  let fallidos = 0;
  let procesados = 0;

  // Procesar en bloques de hasta 10 comprobantes
  const CHUNK_SIZE = state.tamanoLote;
  const totalLotes = Math.ceil(total / CHUNK_SIZE);

  for (let loteIdx = 0; loteIdx < totalLotes; loteIdx++) {
    const inicio = loteIdx * CHUNK_SIZE;
    const lote = aSubir.slice(inicio, inicio + CHUNK_SIZE);
    const nroLote = loteIdx + 1;

    for (let itemIdx = 0; itemIdx < lote.length; itemIdx++) {
      const item = lote[itemIdx];
      procesados++;
      const porcentaje = Math.round(((procesados - 1) / total) * 100);

      dom.progresoTitulo.textContent = `Subiendo comprobante ${procesados} de ${total} (Bloque ${nroLote}/${totalLotes}) • Cliente: ${clienteNombreVerificado}...`;
      dom.progresoPorcentaje.textContent = `${porcentaje}%`;
      dom.barraProgresoEnvio.style.width = `${porcentaje}%`;
      dom.progresoArchivoActual.textContent = `Archivo actual: ${item.nombre}`;

      // Reintento automático inteligente si Google Apps Script responde con "Demasiadas consultas" (código 'limite')
      let exito = false;
      let reintentos = 0;
      const MAX_REINTENTOS = 2;

      while (!exito && reintentos <= MAX_REINTENTOS) {
        try {
          const resp = await fetch("/api/subir-comprobante", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              campana: state.campanaActual,
              rutaCompleta: item.rutaCompleta,
              nombreArchivo: item.nombre,
              dni: dni
            })
          });

          const resJson = await resp.json();

          if (resJson && resJson.ok) {
            exitosos++;
            exito = true;
            item.estado = "SUBIDO";
            item.subidoInfo = { subidoEl: new Date().toISOString() };
            state.selectedFiles.delete(item.nombre);

            state.campanaData.totalSubidos++;
            state.campanaData.totalPendientes--;
            renderResumenCampana(state.campanaData);
          } else if (resJson && resJson.codigo === "limite") {
            reintentos++;
            for (let s = 35; s > 0; s--) {
              dom.progresoArchivoActual.textContent = `⏳ Servidor ocupado (Demasiadas consultas). Esperando ${s}s para reintentar ${item.nombre} (intento ${reintentos}/${MAX_REINTENTOS})...`;
              await new Promise(r => setTimeout(r, 1000));
            }
          } else {
            console.warn(`Error al subir ${item.nombre}:`, resJson);
            break;
          }
        } catch (subidaErr) {
          console.error(`Error de red al subir ${item.nombre}:`, subidaErr);
          break;
        }
      }

      if (!exito) {
        fallidos++;
        item.estado = "ERROR";
      }

      // Pausa preventiva de seguridad de 2.5 segundos entre archivos del bloque (evita saturar el servidor)
      if (itemIdx < lote.length - 1) {
        dom.progresoArchivoActual.textContent = `Pausa preventiva anti-saturación (2.5s)...`;
        await new Promise(r => setTimeout(r, 2500));
      }
    }

    // Actualizar tabla al terminar este bloque de 10
    renderTablaArchivosCampana();
    renderLotesPills();

    // Pausa de enfriamiento de 10 segundos entre bloques de 10 (si quedan más bloques por procesar)
    if (loteIdx < totalLotes - 1) {
      for (let s = 10; s > 0; s--) {
        dom.progresoArchivoActual.textContent = `Bloque ${nroLote} completado. Pausa de seguridad de ${s}s antes del Bloque ${nroLote + 1}...`;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  // Progreso completado al 100%
  dom.progresoPorcentaje.textContent = "100%";
  dom.barraProgresoEnvio.style.width = "100%";
  dom.progresoArchivoActual.textContent = `Subida finalizada: ${exitosos} subidos con éxito${fallidos > 0 ? `, ${fallidos} con error` : ""}.`;

  setTimeout(() => {
    dom.progresoSubidaCard.hidden = true;
  }, 4000);

  state.isUploadingBatch = false;
  if (dom.btnSubirTodo) dom.btnSubirTodo.classList.remove("is-loading");
  if (dom.btnSubirFaltantes) dom.btnSubirFaltantes.classList.remove("is-loading");
  renderResumenCampana(state.campanaData);
  renderTablaArchivosCampana();
  renderLotesPills();
  actualizarEstadoBotonSubir();

  if (fallidos === 0) {
    const extraMsg = omitidosNoEmpresa > 0 ? ` (Se mantuvieron sin subir ${omitidosNoEmpresa} comprobante(s) por tener destino NO Empresa).` : "";
    mostrarAlertaCampana(`¡Éxito! Se subieron los ${exitosos} comprobantes para Empresa correctamente para ${clienteNombreVerificado} (DNI ${dni})${extraMsg}.`, "success");
  } else {
    mostrarAlertaCampana(`Subida finalizada: ${exitosos} exitosos, ${fallidos} con error o duplicados.`, "warning");
  }
}

function mostrarAlertaCampana(mensaje, tipo) {
  dom.estadoEscanearCampana.hidden = false;
  dom.estadoEscanearCampana.className = `alert-box alert-box--${tipo}`;
  dom.estadoEscanearCampana.textContent = mensaje;
}

function ocultarAlertaCampana() {
  dom.estadoEscanearCampana.hidden = true;
  dom.estadoEscanearCampana.textContent = "";
}

/* -------------------------------------------------------------
   5. CONSULTA A LA API (GOOGLE APPS SCRIPT)
   ------------------------------------------------------------- */
async function consultarApi(payload) {
  const respuesta = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  const texto = await respuesta.text();
  try {
    return JSON.parse(texto);
  } catch (e) {
    console.error("Respuesta no parseable:", texto);
    throw new Error("Respuesta inválida del servidor");
  }
}

/* -------------------------------------------------------------
   6. UTILIDADES Y HELPERS
   ------------------------------------------------------------- */
function normalizarDni(valor) {
  return String(valor || "").replace(/[\s.\-_/\\,]/g, "").trim();
}

function dniEsConsultable(dni) {
  return /^\d{6,11}$/.test(dni);
}

function formatearDni(dni) {
  const s = String(dni || "");
  if (s.length === 8) {
    return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5)}`;
  }
  if (s.length === 7) {
    return `${s.slice(0, 1)}.${s.slice(1, 4)}.${s.slice(4)}`;
  }
  return s;
}

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizarMonto(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const cleaned = String(valor).replace(/[^\d.,]/g, "").trim();
  let m = cleaned.match(/^(\d{1,3}(?:\.\d{3})+),(\d{2})$/);
  if (m) {
    const ent = m[1].replace(/\./g, "");
    return m[2] === "00" ? parseInt(ent, 10) : parseFloat(ent + "." + m[2]);
  }
  m = cleaned.match(/^(\d{1,3}(?:\.\d{3})+)$/);
  if (m) return parseInt(m[1].replace(/\./g, ""), 10);
  m = cleaned.match(/^(\d+),(\d{2})$/);
  if (m) return m[2] === "00" ? parseInt(m[1], 10) : parseFloat(m[1] + "." + m[2]);
  m = cleaned.match(/^(\d+)\.(\d{2})$/);
  if (m) return m[2] === "00" ? parseInt(m[1], 10) : parseFloat(m[1] + "." + m[2]);
  m = cleaned.match(/^\d+$/);
  if (m) return parseInt(cleaned, 10);
  return null;
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function parseMonto(montoStr) {
  if (!montoStr) return 0;
  const limpio = String(montoStr).replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(limpio);
  return isNaN(num) ? 0 : num;
}

function formatearMoneda(monto) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2
  }).format(monto);
}

function formatoTituloMes(clave) {
  if (!/^\d{4}-\d{2}$/.test(clave)) return "Sin fecha";
  const mes = Number(clave.slice(5, 7));
  const anio = clave.slice(0, 4);
  const nombreMes = MESES[mes - 1] || "Mes";
  return `${nombreMes} ${anio}`;
}

function formatearFecha(fecha, hora) {
  const f = String(fecha || "").trim();
  const h = String(hora || "").trim().slice(0, 5);
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) {
    const visible = `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;
    return h ? `${visible} ${h}` : visible;
  }
  return h ? `${f} ${h}` : (f || "—");
}

function fechaHoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function enlaceSeguro(url) {
  const texto = String(url || "").trim();
  return texto.startsWith("https://") && texto.length <= 500 ? texto : "";
}

function escaparHtml(valor) {
  return String(valor == null ? "" : valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escaparAtributo(valor) {
  return escaparHtml(valor);
}

function setBotonConsultarCargando(cargando) {
  dom.btnConsultarBajar.classList.toggle("is-loading", cargando);
  dom.btnConsultarBajar.disabled = cargando;
}

function mostrarAlertaConsulta(mensaje, tipo) {
  dom.estadoConsulta.hidden = false;
  dom.estadoConsulta.className = `alert-box alert-box--${tipo}`;
  dom.estadoConsulta.textContent = mensaje;
}

function ocultarAlertaConsulta() {
  dom.estadoConsulta.hidden = true;
  dom.estadoConsulta.textContent = "";
}

function traducirErrorConsulta(datos) {
  const codigo = datos && datos.codigo;
  if (codigo === "dni_invalido") return "El DNI ingresado no es válido.";
  if (codigo === "no_encontrado") return "No se encontró ningún cliente registrado con ese DNI.";
  if (codigo === "ambiguo") return "Ese DNI figura registrado más de una vez en el padrón.";
  if (codigo === "limite") return "Límite de consultas alcanzado. Aguardá unos segundos.";
  return "No se pudieron obtener los comprobantes. Verificá el DNI e intentá nuevamente.";
}

/* Guardar DNI consultados recientemente */
function guardarDniReciente(dni, nombre) {
  try {
    let lista = JSON.parse(localStorage.getItem(STORAGE_KEY_RECENT_DNI) || "[]");
    lista = lista.filter((item) => item.dni !== dni);
    lista.unshift({ dni: dni, nombre: nombre });
    if (lista.length > 5) lista = lista.slice(0, 5);
    localStorage.setItem(STORAGE_KEY_RECENT_DNI, JSON.stringify(lista));
  } catch (e) {}
}

function renderRecentDnis() {
  try {
    const lista = JSON.parse(localStorage.getItem(STORAGE_KEY_RECENT_DNI) || "[]");
    if (!lista.length) {
      dom.quickDniContainer.hidden = true;
      return;
    }
    dom.quickDniContainer.hidden = false;
    dom.quickTagsList.innerHTML = lista.map((it) => `
      <button type="button" class="tag-btn" onclick="window.consultarDniRapido('${it.dni}')">
        ${it.dni} · ${escaparHtml(it.nombre.split(" ")[0])}
      </button>
    `).join("");
  } catch (e) {}
}

window.consultarDniRapido = function (dni) {
  dom.inputDniConsulta.value = dni;
  dom.btnConsultarBajar.disabled = false;
  dom.formConsulta.dispatchEvent(new Event("submit"));
};
