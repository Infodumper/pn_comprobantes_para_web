const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8085;
const BASE_WEB_DIR = __dirname;
const CONFIG_FILE = path.join(BASE_WEB_DIR, 'config.json');
const REGISTRO_FILE = path.join(BASE_WEB_DIR, 'registro_subidos.json');
const API_URL_PERLA_NEGRA = "https://script.google.com/macros/s/AKfycbxMpLnqYvBR7A9OyliThTVm0VclyNIgRVflD9l3cM_2ry34971Z4lk5oJFT6Uw3S6ln/exec";

function readEnvFile() {
  const envPath = path.join(BASE_WEB_DIR, '.env');
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

// Cargar configuración de ruta base de Drive y usuario
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

// Cargar registro de comprobantes ya subidos
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

// MIME types estáticos
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// Recorrer directorio recursivamente
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
          const stat = fs.statSync(fullPath);
          results.push({
            name: entry.name,
            fullPath: fullPath,
            size: stat.size,
            mtime: stat.mtime
          });
        }
      }
    }
  } catch (err) {
    console.error(`Error leyendo ${dir}:`, err);
  }
  return results;
}

// Buscar carpeta correspondiente a una Campaña (CnnAA)
function findCampaignFolder(basePath, campanaCode) {
  if (!fs.existsSync(basePath)) return null;
  const normalizedCode = campanaCode.toUpperCase().trim();
  const entries = fs.readdirSync(basePath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const upper = entry.name.toUpperCase();
      // Si el nombre contiene o empieza con CnnAA (ej: "C1026 TOTAL" o "C1026")
      if (upper.startsWith(normalizedCode) || upper.includes(normalizedCode)) {
        return path.join(basePath, entry.name);
      }
    }
  }
  return null;
}

// Parsea nombre de comprobante: ej. "c1026 10000 clara nieto.jpeg"
function parseReceiptFilename(filename, campana) {
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext).trim();
  
  // Intento de extraer monto y nombre
  // Regex tipo: ^(C\d{4})\s+([\d.]+)\s+(.+)$
  const regex = /^([a-zA-Z]\d{4})\s+([\d.]+)\s+(.+)$/i;
  const m = baseName.match(regex);
  if (m) {
    return {
      campana: m[1].toUpperCase(),
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

// Servidor HTTP
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Headers CORS para desarrollo
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Helper respuesta JSON
  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };

  // Helper parsear body JSON
  const getJsonBody = () => {
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
  };

  // -----------------------------------------------------------
  // RUTAS DE API
  // -----------------------------------------------------------

  // GET /api/config
  if (pathname === '/api/config' && req.method === 'GET') {
    const cfg = getConfig();
    const exists = fs.existsSync(cfg.driveBasePath);
    return sendJson(200, { ok: true, config: cfg, folderExists: exists });
  }

  // POST /api/config
  if (pathname === '/api/config' && req.method === 'POST') {
    try {
      const body = await getJsonBody();
      if (body.driveBasePath) {
        const cfg = getConfig();
        cfg.driveBasePath = body.driveBasePath.trim();
        saveConfig(cfg);
        const exists = fs.existsSync(cfg.driveBasePath);
        return sendJson(200, { ok: true, config: cfg, folderExists: exists });
      }
      return sendJson(400, { ok: false, error: 'driveBasePath requerido' });
    } catch (e) {
      return sendJson(500, { ok: false, error: e.message });
    }
  }

  // GET /api/campanas (detectar carpetas CnnAA disponibles en Drive)
  if (pathname === '/api/campanas' && req.method === 'GET') {
    const cfg = getConfig();
    if (!fs.existsSync(cfg.driveBasePath)) {
      return sendJson(200, { ok: false, error: `No se encuentra la carpeta base: ${cfg.driveBasePath}`, campanas: [] });
    }

    try {
      const entries = fs.readdirSync(cfg.driveBasePath, { withFileTypes: true });
      const campanas = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Extraer patrón CnnAA (ej: C1026, C0126, C1326)
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

      // Ordenar descendente por año y luego número
      campanas.sort((a, b) => b.codigo.localeCompare(a.codigo));

      return sendJson(200, { ok: true, campanas, basePath: cfg.driveBasePath });
    } catch (err) {
      return sendJson(500, { ok: false, error: err.message });
    }
  }

  // GET /api/escanear-campana?campana=CnnAA
  if (pathname === '/api/escanear-campana' && req.method === 'GET') {
    const campana = (parsedUrl.searchParams.get('campana') || '').toUpperCase().trim();
    if (!campana || !/^C\d{4}$/.test(campana)) {
      return sendJson(400, { ok: false, error: 'Código de campaña inválido. Formato requerido: CnnAA (ej: C1026, C1326)' });
    }

    const cfg = getConfig();
    const campaignFolder = findCampaignFolder(cfg.driveBasePath, campana);

    if (!campaignFolder) {
      return sendJson(404, {
        ok: false,
        error: `No se encontró ninguna carpeta correspondiente a la campaña ${campana} en "${cfg.driveBasePath}".`
      });
    }

    // Escanear archivos recursivamente
    const files = listFilesRecursively(campaignFolder);
    const registro = getRegistro();
    const registroCampana = registro[campana] || { archivos: {} };

    let totalSubidos = 0;
    let totalPendientes = 0;

    const listado = files.map(f => {
      const relPath = path.relative(campaignFolder, f.fullPath).replace(/\\/g, '/');
      const yaSubidoInfo = registroCampana.archivos[f.name];
      const yaSubido = Boolean(yaSubidoInfo);

      if (yaSubido) {
        totalSubidos++;
      } else {
        totalPendientes++;
      }

      const parsed = parseReceiptFilename(f.name, campana);

      return {
        nombre: f.name,
        rutaRelativa: relPath,
        rutaCompleta: f.fullPath,
        tamano: f.size,
        fechaModificacion: f.mtime,
        monto: parsed.monto,
        cliente: parsed.clienteOReferencia,
        estado: yaSubido ? 'SUBIDO' : 'PENDIENTE',
        subidoInfo: yaSubidoInfo || null
      };
    });

    return sendJson(200, {
      ok: true,
      campana,
      carpeta: campaignFolder,
      totalArchivos: files.length,
      totalSubidos,
      totalPendientes,
      archivos: listado
    });
  }

  // GET /api/comprobante-preview?campana=CnnAA&archivo=nombre_archivo
  if (pathname === '/api/comprobante-preview' && req.method === 'GET') {
    const campana = (parsedUrl.searchParams.get('campana') || '').toUpperCase().trim();
    const archivo = parsedUrl.searchParams.get('archivo') || '';

    if (!campana || !archivo) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Faltan parámetros (campana, archivo)');
    }

    const cfg = getConfig();
    const campaignFolder = findCampaignFolder(cfg.driveBasePath, campana);
    if (!campaignFolder) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Carpeta de campaña no encontrada');
    }

    const files = listFilesRecursively(campaignFolder);
    const targetFile = files.find(f => f.name === archivo);
    if (!targetFile || !fs.existsSync(targetFile.fullPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Archivo no encontrado');
    }

    const ext = path.extname(targetFile.name).toLowerCase();
    const contentType = ext === '.pdf' ? 'application/pdf' : (ext === '.png' ? 'image/png' : 'image/jpeg');

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600'
    });

    const stream = fs.createReadStream(targetFile.fullPath);
    stream.on('error', (err) => {
      console.warn(`Error leyendo archivo ${targetFile.name}:`, err.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end();
    });
    return stream.pipe(res);
  }

  // POST /api/subir-comprobante (Sube uno individual a la API y actualiza registro)
  if (pathname === '/api/subir-comprobante' && req.method === 'POST') {
    try {
      const body = await getJsonBody();
      const { campana, rutaCompleta, nombreArchivo, dni } = body;

      if (!campana || !rutaCompleta || !nombreArchivo) {
        return sendJson(400, { ok: false, error: 'Faltan parámetros requeridos (campana, rutaCompleta, nombreArchivo).' });
      }

      if (!fs.existsSync(rutaCompleta)) {
        return sendJson(404, { ok: false, error: `El archivo ya no existe en el disco: ${rutaCompleta}` });
      }

      const cfg = getConfig();
      const dniCliente = String(dni || cfg.dniUsuario || "").replace(/[\s.\-_/\\,]/g, "").trim();

      if (!dniCliente || dniCliente === "0") {
        return sendJson(400, {
          ok: false,
          nombreArchivo,
          error: `Falta configurar DNI_USUARIO en el archivo .env para el usuario ${cfg.nombreUsuario || 'Paola Estévez'}.`,
          codigo: 'dni_requerido'
        });
      }

      // Leer archivo y convertir a Base64
      const fileBuffer = fs.readFileSync(rutaCompleta);
      const base64Data = fileBuffer.toString('base64');
      const ext = path.extname(nombreArchivo).toLowerCase();
      const mimeType = ext === '.pdf' ? 'application/pdf' : (ext === '.png' ? 'image/png' : 'image/jpeg');

      // Preparar payload para la API de Google Apps Script
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
          // Si la respuesta es ok o duplicado, consideramos que ya quedó registrado
          if (apiResponse && (apiResponse.ok === true || apiResponse.codigo === 'duplicado')) {
            ok = true;
          } else {
            const cod = apiResponse && apiResponse.codigo ? apiResponse.codigo : '';
            if (cod === 'dni_invalido') {
              errorMsg = `El DNI configurado en .env ("${dniCliente}") no es un DNI válido.`;
            } else if (cod === 'no_encontrado') {
              errorMsg = `El DNI configurado en .env ("${dniCliente}" - ${cfg.nombreUsuario}) no figura en el padrón de la web.`;
            } else if (cod) {
              errorMsg = cod;
            } else {
              errorMsg = resText;
            }
          }
        } catch (e) {
          apiResponse = { raw: resText };
          ok = true; // Apps Script a veces devuelve HTML de confirmación
        }
      } catch (fetchErr) {
        console.error("Error al conectar con la API de Perla Negra:", fetchErr);
        errorMsg = fetchErr.message;
      }

      // Si la subida fue exitosa (o duplicada), asentar en el registro persistente
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

      return sendJson(200, {
        ok,
        nombreArchivo,
        error: errorMsg,
        apiResponse
      });

    } catch (err) {
      console.error("Error en /api/subir-comprobante:", err);
      return sendJson(500, { ok: false, error: err.message });
    }
  }

  // GET /api/registro (Obtener comprobantes registrados como subidos)
  if (pathname === '/api/registro' && req.method === 'GET') {
    const campana = (parsedUrl.searchParams.get('campana') || '').toUpperCase().trim();
    const registro = getRegistro();
    if (campana) {
      return sendJson(200, { ok: true, campana, registro: registro[campana] || { archivos: {} } });
    }
    return sendJson(200, { ok: true, registro });
  }

  // -----------------------------------------------------------
  // SERVIR ARCHIVOS ESTÁTICOS DE LA WEB
  // -----------------------------------------------------------
  let safePath = pathname === '/' ? '/index.html' : pathname;
  safePath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(BASE_WEB_DIR, safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    const staticStream = fs.createReadStream(filePath);
    staticStream.on('error', (err) => {
      console.error(`Error leyendo estático ${filePath}:`, err.message);
      res.end();
    });
    staticStream.pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Servidor Comprobantes Web corriendo en: http://localhost:${PORT}`);
  console.log(`Google Drive Base: ${getConfig().driveBasePath}`);
  console.log(`====================================================`);
});
