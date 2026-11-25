const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE_DIR = __dirname;
const CONFIG_FILE = path.join(BASE_DIR, 'config.json');
const REGISTRO_FILE = path.join(BASE_DIR, 'registro_subidos.json');
const DESTINATARIOS_CACHE_FILE = path.join(BASE_DIR, 'destinatarios_cache.json');
const API_URL_PERLA_NEGRA = "https://script.google.com/macros/s/AKfycbxMpLnqYvBR7A9OyliThTVm0VclyNIgRVflD9l3cM_2ry34971Z4lk5oJFT6Uw3S6ln/exec";

function getDestinatariosCache() {
  try {
    if (fs.existsSync(DESTINATARIOS_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(DESTINATARIOS_CACHE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error("Error leyendo destinatarios_cache.json:", e);
  }
  return {};
}

function saveDestinatariosCache(cache) {
  try {
    fs.writeFileSync(DESTINATARIOS_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (e) {
    console.error("Error guardando destinatarios_cache.json:", e);
  }
}

function parseDestinatarioFromText(text) {
  if (!text) return "No legible";
  const clean = text.replace(/\s+/g, ' ');

  // Si contiene alguna variación de Perla Negra, CUIT o CBU, se unifica como "Empresa"
  if (/\b(?:perla\s*negra|ria\s*negra|negra\s*sr[li1]|perlanegra)\b/i.test(clean) ||
      /\b30-?70865775-?8\b/.test(clean) ||
      /\b0720164220000001125540\b/.test(clean)) {
    return "Empresa";
  }

  const normalizarDest = (val) => {
    let limpio = val.replace(/^(?:apellido\s*y\s*nombre|titular|nombre)[:\s]*/i, '').trim();
    if (/\b(?:perla\s*negra|ria\s*negra|negra\s*sr[li1]|perlanegra)\b/i.test(limpio) ||
        /\b30-?70865775-?8\b/.test(limpio) ||
        /\b0720164220000001125540\b/.test(limpio)) {
      return "Empresa";
    }
    return limpio;
  };

  // 1. Regex para "Beneficiario ..."
  let m = clean.match(/\bbeneficiari[oa][:s\s]+([^,]+?)(?=\s+(?:banco|cbu|cvu|cuit|cuil|\d{5,}|$))/i);
  if (m && m[1].trim().length > 2 && m[1].trim().length < 55) {
    return normalizarDest(m[1]);
  }

  // 2. Regex para "Cuenta destino ..."
  m = clean.match(/cuenta\s+destino[:\s]+([^,]+?)(?=\s+(?:banco|cbu|cvu|cuit|cuil|\d{5,}|$))/i);
  if (m && m[1].trim().length > 2 && m[1].trim().length < 55) {
    return normalizarDest(m[1]);
  }

  // 3. Regex para "Para ..."
  m = clean.match(/\bpara[:\s]+([^,]+?)(?=\s+(?:banco|cbu|cvu|cuit|cuil|\d{5,}|$))/i);
  if (m && m[1].trim().length > 2 && m[1].trim().length < 55) {
    return normalizarDest(m[1]);
  }

  // 4. Regex para "Destinatario ..."
  m = clean.match(/destinatari[oa][:s\s]+([^,]+?)(?=\s+(?:banco|cbu|cvu|cuit|cuil|\d{5,}|$))/i);
  if (m && m[1].trim().length > 2 && m[1].trim().length < 55) {
    return normalizarDest(m[1]);
  }

  // 5. Regex para "Transferencia enviada a ..."
  m = clean.match(/transferencia\s+enviada\s+a[:\s]+([^,]+?)(?=\s+(?:banco|cbu|cvu|cuit|cuil|\$|\d{5,}|$))/i);
  if (m && m[1].trim().length > 2 && m[1].trim().length < 55) {
    return normalizarDest(m[1]);
  }

  // 6. Regex para "Envío de dinero a ..."
  m = clean.match(/env[ií]o\s+de\s+dinero\s+a[:\s]+([^,]+?)(?=\s+(?:banco|cbu|cvu|cuit|cuil|\$|\d{5,}|$))/i);
  if (m && m[1].trim().length > 2 && m[1].trim().length < 55) {
    return normalizarDest(m[1]);
  }

  return "No identificado";
}

function detectBancoOrigenFromText(text) {
  if (!text) return "No identificado";
  const clean = text.replace(/\s+/g, ' ');

  // 1. Bancos y Billeteras específicas de origen
  if (/\b(?:credicoop|banco\s*credicoop)\b/i.test(clean)) return "Banco Credicoop";
  if (/\b(?:mercado\s*pago|mercadopago)\b/i.test(clean)) return "Mercado Pago";
  if (/\b(?:naranja\s*x|naranjax|naranja\)\(|naranja\s*digital)\b/i.test(clean)) return "Naranja X";
  if (/\b(?:cuenta\s*dni|cuenta\s+comprobante|banco\s*provincia|bapro)\b/i.test(clean) || /código\s+de\s+referencia\s+\d{8}/i.test(clean)) return "Cuenta DNI";
  if (/\b(?:personal\s*pay|personalpay)\b/i.test(clean)) return "Personal Pay";
  if (/\b(?:banco\s*(?:de\s+la\s+)?naci[oó]n|bna\+?)\b/i.test(clean)) return "Banco Nación";
  if (/\bgalicia\b/i.test(clean) && !/(?:destino|beneficiario|para)[^.]*galicia/i.test(clean)) return "Galicia";
  if (/\b(?:bbva|franc[eé]s)\b/i.test(clean) && !/(?:destino|beneficiario|para)[^.]*bbva/i.test(clean)) return "BBVA";
  if (/\b(?:brubank|brubonk)\b/i.test(clean)) return "Brubank";
  if (/\bual[aá]\b/i.test(clean)) return "Ualá";
  if (/\b(?:macro\s*bma|banco\s*macro|macro\s*online)\b/i.test(clean)) return "Banco Macro";
  if (/\bpatagonia\b/i.test(clean)) return "Banco Patagonia";
  if (/\b(?:banco\s*ciudad)\b/i.test(clean)) return "Banco Ciudad";
  if (/\bcomafi\b/i.test(clean)) return "Banco Comafi";
  if (/\bsupervielle\b/i.test(clean)) return "Supervielle";

  // 2. Detección por CBU / CVU de origen
  if (/\b00000031\d{14}\b/.test(clean)) return "Mercado Pago";
  if (/\b453\d{19}\b/.test(clean)) return "Naranja X";
  if (/\b00000062\d{14}\b/.test(clean)) return "Personal Pay";
  if (/\b00000079\d{14}\b/.test(clean)) return "Ualá";

  // 3. Santander SOLO si es el emisor y no simplemente el destino donde Perla Negra cobra
  if (/\bonline\s+banking\s+personas\b/i.test(clean) || /\bcuenta\s+d[eé]bito\b/i.test(clean) || /\bimporte\s+debitado\b/i.test(clean)) {
    return "Santander";
  }

  const sinDestino = clean.replace(/(?:beneficiario|para|destino|banco\s+de\s+destino|banco\s+destino)[^.]*(?:santander|perla\s*negra)/gi, '');
  if (/\bsantander\b/i.test(sinDestino)) {
    return "Santander";
  }

  return "No identificado";
}

function normalizeAmount(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/[^\d.,]/g, '');
  let m = cleaned.match(/^(\d{1,3}(?:\.\d{3})+),(\d{2})$/);
  if (m) {
    const ent = m[1].replace(/\./g, '');
    return m[2] === '00' ? parseInt(ent, 10) : parseFloat(ent + '.' + m[2]);
  }
  m = cleaned.match(/^(\d{1,3}(?:\.\d{3})+)$/);
  if (m) return parseInt(m[1].replace(/\./g, ''), 10);
  m = cleaned.match(/^(\d+),(\d{2})$/);
  if (m) return m[2] === '00' ? parseInt(m[1], 10) : parseFloat(m[1] + '.' + m[2]);
  m = cleaned.match(/^(\d+)\.(\d{2})$/);
  if (m) return m[2] === '00' ? parseInt(m[1], 10) : parseFloat(m[1] + '.' + m[2]);
  m = cleaned.match(/^\d+$/);
  if (m) return parseInt(cleaned, 10);
  return null;
}

function extractAmountFromText(text) {
  if (!text) return null;
  const clean = text.replace(/\s+/g, ' ');

  // 1. Patrones explícitos con palabras clave y signo $ o s/S
  let m = clean.match(/(?:importe\s*total|importe\s*debitado|monto|enviaste|transferiste|importe)[:\s]*[\$sS]\s*([\d.,]+(?:\s+\d{2})?)/i);
  if (m) {
    const n = normalizeAmount(m[1].replace(/\s+/g, ''));
    if (n && n > 0) return n;
  }

  // 1b. Patrones explícitos sin signo $, pero que NO sean una fecha (evita capturar "23" de "23/NOV/2026" o "23/11")
  m = clean.match(/(?:importe\s*total|importe\s*debitado|monto|enviaste|transferiste|importe)[:\s]*([\d]{1,3}(?:\.[\d]{3})+(?:,[\d]{2})?|\d{3,}(?:,[\d]{2})?)(?!\s*[\/-]|\s*(?:de\s+)?(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic))/i);
  if (m) {
    const n = normalizeAmount(m[1]);
    if (n && n > 0) return n;
  }

  // 2. Mercado Pago: "$ 114.400 Motivo:" o similar
  m = clean.match(/[\$sS]\s*([\d]{1,3}(?:\.[\d]{3})+(?:,[\d]{2})?)\s*(?:motivo|para|origen|\.)/i);
  if (m) {
    const n = normalizeAmount(m[1]);
    if (n && n > 0) return n;
  }

  // 3. $ seguido de miles con punto
  m = clean.match(/[\$sS]\s*([\d]{1,3}(?:\.[\d]{3})+(?:,[\d]{2})?)/i);
  if (m) {
    const n = normalizeAmount(m[1]);
    if (n && n > 0) return n;
  }

  // 4. $ seguido de números de al menos 4 cifras
  m = clean.match(/[\$sS]\s*(\d{4,}(?:,[\d]{2})?)/i);
  if (m) {
    const n = normalizeAmount(m[1]);
    if (n && n > 0) return n;
  }

  return null;
}

async function extractDestinatarioFromPdf(pdfPath) {
  try {
    const { PDFParse } = require('pdf-parse');
    const buf = fs.readFileSync(pdfPath);
    const parser = new PDFParse(new Uint8Array(buf));
    const result = await parser.getText();
    const text = result.text || '';
    return {
      destinatario: parseDestinatarioFromText(text),
      origen: detectBancoOrigenFromText(text),
      montoDoc: extractAmountFromText(text)
    };
  } catch (err) {
    return {
      destinatario: "No legible",
      origen: "No identificado",
      montoDoc: null
    };
  }
}

function runOcrOnFolder(folderPath) {
  try {
    const scriptPath = path.join(BASE_DIR, 'extract_ocr.ps1');
    if (!fs.existsSync(scriptPath)) return {};
    const out = execFileSync('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-FolderPath', folderPath], {
      encoding: 'utf-8',
      timeout: 30000
    });
    const jsonStart = out.indexOf('{');
    if (jsonStart !== -1) {
      return JSON.parse(out.slice(jsonStart));
    }
  } catch (err) {
    console.warn('Advertencia en OCR local:', err.message);
  }
  return {};
}

function readEnvFile() {
  const envPath = path.join(BASE_DIR, '.env');
  const envVars = {};
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          envVars[key] = val;
        }
      }
    } catch (e) {
      console.error("Error leyendo .env:", e);
    }
  }
  return envVars;
}

function getConfig() {
  const envVars = readEnvFile();
  const defaultConfig = {
    driveBasePath: envVars.DRIVE_BASE_PATH || 'C:\\PerlaNegra\\02 PAGOS',
    dniUsuario: envVars.DNI_USUARIO || envVars.DNI_SUBIDA || '',
    nombreUsuario: envVars.NOMBRE_USUARIO || envVars.USUARIO_SUBIDA || 'Paola Estévez'
  };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const jsonCfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      Object.assign(defaultConfig, jsonCfg);
    }
  } catch (e) {
    console.error("Error leyendo config:", e);
  }
  // .env tiene prioridad sobre config.json
  if (envVars.DNI_USUARIO !== undefined) defaultConfig.dniUsuario = String(envVars.DNI_USUARIO).trim();
  if (envVars.NOMBRE_USUARIO) defaultConfig.nombreUsuario = String(envVars.NOMBRE_USUARIO).trim();
  if (envVars.DRIVE_BASE_PATH) defaultConfig.driveBasePath = String(envVars.DRIVE_BASE_PATH).trim();

  return defaultConfig;
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) {
    console.error("Error guardando config:", e);
  }
}

function getRegistro() {
  try {
    if (fs.existsSync(REGISTRO_FILE)) {
      return JSON.parse(fs.readFileSync(REGISTRO_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error("Error leyendo registro_subidos.json:", e);
  }
  return {};
}

function saveRegistro(registro) {
  try {
    fs.writeFileSync(REGISTRO_FILE, JSON.stringify(registro, null, 2), 'utf-8');
  } catch (e) {
    console.error("Error guardando registro_subidos.json:", e);
  }
}

function listFilesRecursively(dir, extensions = ['.jpg', '.jpeg', '.png', '.pdf']) {
  let results = [];
  try {
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(listFilesRecursively(fullPath, extensions));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          try {
            const stat = fs.statSync(fullPath);
            results.push({
              name: entry.name,
              fullPath: fullPath,
              size: stat.size,
              mtime: stat.mtime
            });
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.error(`Error leyendo ${dir}:`, err);
  }
  return results;
}

function findCampaignFolder(basePath, campanaCode) {
  if (!fs.existsSync(basePath)) return null;
  const normalizedCode = campanaCode.toUpperCase().trim();
  try {
    const entries = fs.readdirSync(basePath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const upper = entry.name.toUpperCase();
        if (upper.startsWith(normalizedCode) || upper.includes(normalizedCode)) {
          return path.join(basePath, entry.name);
        }
      }
    }
  } catch (e) {}
  return null;
}

function parseReceiptFilename(filename, campana) {
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext).trim();
  // Acepta C1126 o 1126 (con o sin letra C)
  const regex = /^([a-zA-Z]?\d{4})\s+([\d.]+)\s+(.+)$/i;
  const m = baseName.match(regex);
  if (m) {
    let cod = m[1].toUpperCase();
    if (!cod.startsWith('C') && /^\d{4}$/.test(cod)) cod = 'C' + cod;
    return {
      campana: cod,
      monto: m[2],
      clienteOReferencia: m[3].trim()
    };
  }
  return {
    campana: campana || "",
    monto: "",
    clienteOReferencia: baseName
  };
}

function getJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function handleApiRequest(req, res, pathname, parsedUrl) {
  // Normalizar prefijo: acepta tanto /api/... como /comprobantes_para_web/api/...
  let apiPath = pathname;
  if (apiPath.startsWith('/comprobantes_para_web/api/')) {
    apiPath = apiPath.replace('/comprobantes_para_web/api/', '/api/');
  }

  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
  };

  // GET /api/config
  if (apiPath === '/api/config' && req.method === 'GET') {
    const cfg = getConfig();
    const exists = fs.existsSync(cfg.driveBasePath);
    sendJson(200, { ok: true, config: cfg, folderExists: exists });
    return true;
  }

  // GET /api/verificar-cliente
  if (apiPath === '/api/verificar-cliente' && req.method === 'GET') {
    const cfg = getConfig();
    const dniRaw = parsedUrl.searchParams.get('dni') || cfg.dniUsuario || '';
    const dni = String(dniRaw).replace(/[\s.\-_/\\,]/g, '').trim();
    if (!dni) {
      sendJson(400, { ok: false, error: 'DNI no especificado ni configurado en .env' });
      return true;
    }
    try {
      const fetchRes = await fetch(API_URL_PERLA_NEGRA, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: 'buscarCliente', dni: dni })
      });
      const data = await fetchRes.json();
      sendJson(200, data);
      return true;
    } catch (err) {
      console.error('Error al verificar cliente en API:', err);
      sendJson(500, { ok: false, error: err.message });
      return true;
    }
  }

  // POST /api/config
  if (apiPath === '/api/config' && req.method === 'POST') {
    try {
      const body = await getJsonBody(req);
      if (body.driveBasePath) {
        const cfg = getConfig();
        cfg.driveBasePath = body.driveBasePath.trim();
        saveConfig(cfg);
        const exists = fs.existsSync(cfg.driveBasePath);
        sendJson(200, { ok: true, config: cfg, folderExists: exists });
        return true;
      }
      sendJson(400, { ok: false, error: 'driveBasePath requerido' });
      return true;
    } catch (e) {
      sendJson(500, { ok: false, error: e.message });
      return true;
    }
  }

  // GET /api/campanas
  if (apiPath === '/api/campanas' && req.method === 'GET') {
    const cfg = getConfig();
    if (!fs.existsSync(cfg.driveBasePath)) {
      sendJson(200, { ok: false, error: `No se encuentra la carpeta base: ${cfg.driveBasePath}`, campanas: [] });
      return true;
    }

    try {
      const entries = fs.readdirSync(cfg.driveBasePath, { withFileTypes: true });
      const campanas = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const match = entry.name.match(/\b(C\d{4})\b/i);
          if (match) {
            const code = match[1].toUpperCase();
            const fullPath = path.join(cfg.driveBasePath, entry.name);
            campanas.push({
              codigo: code,
              carpeta: entry.name,
              path: fullPath
            });
          }
        }
      }

      campanas.sort((a, b) => b.codigo.localeCompare(a.codigo));
      sendJson(200, { ok: true, campanas, basePath: cfg.driveBasePath });
      return true;
    } catch (err) {
      sendJson(500, { ok: false, error: err.message });
      return true;
    }
  }

  // GET /api/escanear-campana
  if (apiPath === '/api/escanear-campana' && req.method === 'GET') {
    const campana = (parsedUrl.searchParams.get('campana') || '').toUpperCase().trim();
    if (!campana || !/^C\d{4}$/.test(campana)) {
      sendJson(400, { ok: false, error: 'Código de campaña inválido. Formato requerido: CnnAA (ej: C1026, C1326)' });
      return true;
    }

    const cfg = getConfig();
    const campaignFolder = findCampaignFolder(cfg.driveBasePath, campana);

    if (!campaignFolder) {
      sendJson(404, {
        ok: false,
        error: `No se encontró ninguna carpeta correspondiente a la campaña ${campana} en "${cfg.driveBasePath}".`
      });
      return true;
    }

    const files = listFilesRecursively(campaignFolder);
    const registro = getRegistro();
    const registroCampana = registro[campana] || { archivos: {} };
    const destCache = getDestinatariosCache();

    // Comprobar si hay archivos cuyo destinatario aún no esté en caché o esté pendiente/no identificado
    const archivosSinCache = files.filter(f => {
      const c = destCache[f.name];
      if (!c) return true;
      if (typeof c === 'object' && (c.destinatario === 'No identificado' || c.destinatario === 'No legible' || c.destinatario === 'Pendiente de sincronizar')) {
        return true;
      }
      return false;
    });

    if (archivosSinCache.length > 0) {
      // 1. Ejecutar OCR para imágenes y PDFs de la carpeta
      const ocrData = runOcrOnFolder(campaignFolder);
      for (const [fname, item] of Object.entries(ocrData)) {
        if (item && item.destinatario && item.destinatario !== 'Pendiente de sincronizar') {
          destCache[fname] = {
            destinatario: item.destinatario || 'Empresa',
            origen: item.origen || 'No identificado',
            montoDoc: item.montoDoc !== undefined ? item.montoDoc : null
          };
        }
      }

      // 2. Si todavía queda algún PDF sin resolver, intentar con pdf-parse
      for (const f of archivosSinCache) {
        if ((!destCache[f.name] || destCache[f.name].destinatario === 'No identificado') && path.extname(f.name).toLowerCase() === '.pdf') {
          try {
            const destPdf = await extractDestinatarioFromPdf(f.fullPath);
            if (destPdf && destPdf.destinatario && destPdf.destinatario !== 'No legible' && destPdf.destinatario !== 'No identificado') {
              destCache[f.name] = destPdf;
            }
          } catch (e) {
            // Mantener valor existente
          }
        }
      }

      saveDestinatariosCache(destCache);
    }

    let totalSubidos = 0;
    let totalPendientes = 0;

    const listado = files.map(f => {
      const relPath = path.relative(campaignFolder, f.fullPath).replace(/\\/g, '/');
      const yaSubidoInfo = registroCampana.archivos[f.name];
      const yaSubido = Boolean(yaSubidoInfo);

      if (yaSubido) totalSubidos++;
      else totalPendientes++;

      const parsed = parseReceiptFilename(f.name, campana);
      const cached = destCache[f.name];
      let destinatario = 'Empresa';
      let origen = 'No identificado';
      let montoDoc = null;

      if (typeof cached === 'string') {
        destinatario = (/perla\s*negra/i.test(cached) || cached === 'Empresa') ? 'Empresa' : cached;
      } else if (cached && typeof cached === 'object') {
        destinatario = cached.destinatario || 'Empresa';
        if (/perla\s*negra/i.test(destinatario)) destinatario = 'Empresa';
        origen = cached.origen || 'No identificado';
        montoDoc = cached.montoDoc !== undefined ? cached.montoDoc : null;
      }

      return {
        nombre: f.name,
        rutaRelativa: relPath,
        rutaCompleta: f.fullPath,
        tamano: f.size,
        fechaModificacion: f.mtime,
        monto: parsed.monto,
        montoDoc: montoDoc,
        cliente: parsed.clienteOReferencia,
        destinatario: destinatario,
        origen: origen,
        estado: yaSubido ? 'SUBIDO' : 'PENDIENTE',
        subidoInfo: yaSubidoInfo || null
      };
    });

    sendJson(200, {
      ok: true,
      campana,
      carpeta: campaignFolder,
      totalArchivos: files.length,
      totalSubidos,
      totalPendientes,
      archivos: listado
    });
    return true;
  }

  // GET /api/comprobante-preview
  if (apiPath === '/api/comprobante-preview' && req.method === 'GET') {
    const campana = (parsedUrl.searchParams.get('campana') || '').toUpperCase().trim();
    const archivo = parsedUrl.searchParams.get('archivo') || '';

    if (!campana || !archivo) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Faltan parámetros (campana, archivo)');
      return true;
    }

    const cfg = getConfig();
    const campaignFolder = findCampaignFolder(cfg.driveBasePath, campana);
    if (!campaignFolder) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Carpeta de campaña no encontrada');
      return true;
    }

    const files = listFilesRecursively(campaignFolder);
    const targetFile = files.find(f => f.name === archivo);
    if (!targetFile || !fs.existsSync(targetFile.fullPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Archivo no encontrado');
      return true;
    }

    const ext = path.extname(targetFile.name).toLowerCase();
    const contentType = ext === '.pdf' ? 'application/pdf' : (ext === '.png' ? 'image/png' : 'image/jpeg');

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(targetFile.fullPath);
    stream.on('error', (err) => {
      console.warn(`Error leyendo archivo ${targetFile.name}:`, err.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end();
    });
    stream.pipe(res);
    return true;
  }

  // POST /api/subir-comprobante
  if (apiPath === '/api/subir-comprobante' && req.method === 'POST') {
    try {
      const body = await getJsonBody(req);
      const { campana, rutaCompleta, nombreArchivo, dni } = body;

      if (!campana || !rutaCompleta || !nombreArchivo) {
        sendJson(400, { ok: false, error: 'Faltan parámetros requeridos (campana, rutaCompleta, nombreArchivo).' });
        return true;
      }

      if (!fs.existsSync(rutaCompleta)) {
        sendJson(404, { ok: false, error: `El archivo ya no existe en el disco: ${rutaCompleta}` });
        return true;
      }

      const cfg = getConfig();
      const dniCliente = String(dni || cfg.dniUsuario || "").replace(/[\s.\-_/\\,]/g, "").trim();

      if (!dniCliente || dniCliente === "0") {
        sendJson(400, {
          ok: false,
          nombreArchivo,
          error: `Falta configurar DNI_USUARIO en el archivo .env para el usuario ${cfg.nombreUsuario || 'Paola Estévez'}.`,
          codigo: 'dni_requerido'
        });
        return true;
      }

      const fileBuffer = fs.readFileSync(rutaCompleta);
      const base64Data = fileBuffer.toString('base64');
      const ext = path.extname(nombreArchivo).toLowerCase();
      const mimeType = ext === '.pdf' ? 'application/pdf' : (ext === '.png' ? 'image/png' : 'image/jpeg');

      const payload = {
        dni: dniCliente,
        archivo: base64Data,
        nombreArchivo: nombreArchivo,
        mimeType: mimeType,
        campana: campana
      };

      let apiResponse = null;
      let ok = false;
      let errorMsg = null;

      try {
        const fetchRes = await fetch(API_URL_PERLA_NEGRA, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        const resText = await fetchRes.text();
        try {
          apiResponse = JSON.parse(resText);
          if (apiResponse && (apiResponse.ok === true || apiResponse.codigo === 'duplicado')) {
            ok = true;
          } else {
            const cod = apiResponse && apiResponse.codigo ? apiResponse.codigo : '';
            if (cod === 'dni_invalido') {
              errorMsg = `El DNI configurado en .env ("${dniCliente}") no es un DNI válido.`;
            } else if (cod === 'no_encontrado') {
              errorMsg = `El DNI configurado en .env ("${dniCliente}" - ${cfg.nombreUsuario}) no figura en el padrón de la web.`;
            } else if (cod === 'limite') {
              errorMsg = 'Demasiadas consultas en el servidor central. Esperá un momento e intentá de nuevo.';
            } else if (cod) {
              errorMsg = cod;
            } else {
              errorMsg = resText;
            }
          }
        } catch (e) {
          apiResponse = { raw: resText };
          ok = true;
        }
      } catch (fetchErr) {
        console.error("Error al conectar con la API de Perla Negra:", fetchErr);
        errorMsg = fetchErr.message;
      }

      if (ok) {
        const registro = getRegistro();
        if (!registro[campana]) {
          registro[campana] = { archivos: {}, ultimaActualizacion: new Date().toISOString() };
        }
        registro[campana].archivos[nombreArchivo] = {
          subidoEl: new Date().toISOString(),
          tamano: fileBuffer.length,
          resultado: apiResponse && apiResponse.codigo === 'duplicado' ? 'duplicado_existente' : 'subido_exitoso'
        };
        registro[campana].ultimaActualizacion = new Date().toISOString();
        saveRegistro(registro);
      }

      sendJson(200, { ok, codigo: apiResponse && apiResponse.codigo ? apiResponse.codigo : null, nombreArchivo, error: errorMsg, apiResponse });
      return true;

    } catch (err) {
      sendJson(500, { ok: false, error: err.message });
      return true;
    }
  }

  // POST /api/actualizar-destinatario
  if (apiPath === '/api/actualizar-destinatario' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { archivo, destinatario } = body;
      if (!archivo || !destinatario) {
        sendJson(400, { ok: false, error: 'Faltan parámetros requeridos (archivo, destinatario).' });
        return true;
      }
      const cache = getDestinatariosCache();
      const prev = cache[archivo] || {};
      cache[archivo] = {
        ...prev,
        destinatario: destinatario === 'Empresa' ? 'Empresa' : destinatario
      };
      saveDestinatariosCache(cache);
      sendJson(200, { ok: true, archivo, destinatario: cache[archivo].destinatario });
      return true;
    } catch (err) {
      sendJson(500, { ok: false, error: err.message });
      return true;
    }
  }

  // GET /api/generar-excel
  if (apiPath === '/api/generar-excel' && req.method === 'GET') {
    const campana = (parsedUrl.searchParams.get('campana') || '').toUpperCase().trim();
    if (!campana || !/^C\d{4}$/.test(campana)) {
      sendJson(400, { ok: false, error: 'Código de campaña inválido (ej: C1026).' });
      return true;
    }
    try {
      const modPath = path.join(__dirname, 'generar_excel.js');
      delete require.cache[require.resolve(modPath)];
      const { generarExcelCampana } = require(modPath);
      const resultado = await generarExcelCampana(campana);
      sendJson(200, {
        ok: true,
        campana,
        archivo: path.basename(resultado.outputPath),
        totalProcesados: resultado.totalProcesados,
        ruta: resultado.outputPath
      });
      return true;
    } catch (e) {
      sendJson(500, { ok: false, error: e.message });
      return true;
    }
  }

  // GET /api/descargar-excel
  if (apiPath === '/api/descargar-excel' && req.method === 'GET') {
    const campana = (parsedUrl.searchParams.get('campana') || '').toUpperCase().trim();
    const fileName = `comprobantes_${campana.toLowerCase()}.xlsx`;
    const filePath = path.join(BASE_DIR, 'Excels', fileName);

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`El Excel de la campaña ${campana} no existe. Genérelo primero.`);
      return true;
    }

    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  // GET /api/registro
  if (apiPath === '/api/registro' && req.method === 'GET') {
    const campana = (parsedUrl.searchParams.get('campana') || '').toUpperCase().trim();
    const registro = getRegistro();
    if (campana) {
      sendJson(200, { ok: true, campana, registro: registro[campana] || { archivos: {} } });
      return true;
    }
    sendJson(200, { ok: true, registro });
    return true;
  }

  return false;
}

module.exports = {
  handleApiRequest
};
