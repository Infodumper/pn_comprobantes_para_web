const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const XLSX = require('xlsx');

const BASE_DIR = __dirname;
const CONFIG_FILE = path.join(BASE_DIR, 'config.json');
const EXCELS_DIR = path.join(BASE_DIR, 'Excels');
const OCR_CACHE_FILE = path.join(BASE_DIR, 'ocr_full_cache.json');

function getOcrCache() {
  try {
    if (fs.existsSync(OCR_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(OCR_CACHE_FILE, 'utf-8'));
    }
  } catch (e) {}
  return {};
}

function saveOcrCache(cache) {
  try {
    fs.writeFileSync(OCR_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (e) {}
}

if (!fs.existsSync(EXCELS_DIR)) {
  fs.mkdirSync(EXCELS_DIR, { recursive: true });
}

function getConfig() {
  const defaultConfig = {
    driveBasePath: 'G:\\Mi unidad\\Perla Negra Drive\\Perla Negra\\02 PAGOS'
  };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return Object.assign(defaultConfig, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')));
    }
  } catch (e) {
    console.error("Error leyendo config:", e);
  }
  return defaultConfig;
}

function normalizeDate(str) {
  if (!str) return "";
  const meses = {
    'enero': '01', 'ene': '01', 'jan': '01',
    'febrero': '02', 'feb': '02',
    'marzo': '03', 'mar': '03',
    'abril': '04', 'abr': '04', 'apr': '04',
    'mayo': '05', 'may': '05',
    'junio': '06', 'jun': '06',
    'julio': '07', 'jul': '07',
    'agosto': '08', 'ago': '08', 'aug': '08',
    'septiembre': '09', 'sep': '09', 'set': '09',
    'octubre': '10', 'oct': '10',
    'noviembre': '11', 'nov': '11',
    'diciembre': '12', 'dic': '12', 'dec': '12'
  };

  // 1. Formato DD/MM/AAAA o DD-MM-AAAA
  let m = str.match(/\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})\b/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    let y = m[3];
    if (y.length === 2) y = '20' + y;
    return `${d}/${mo}/${y}`;
  }

  // 2. Formato con nombre de mes: 21/octubre/2026, 20/OCT/2026, 21 de octubre de 2026
  m = str.match(/\b(\d{1,2})(?:[\/\s]+|(?:\s+de\s+))([a-zA-ZáéíóúÁÉÍÓÚ]{3,12})(?:[\/\s]+|(?:\s+de\s+))(\d{2,4})\b/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mesKey = m[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const mo = meses[mesKey] || meses[mesKey.substring(0, 3)] || '10';
    let y = m[3];
    if (y.length === 2) y = '20' + y;
    return `${d}/${mo}/${y}`;
  }

  return str.trim();
}

function parseDestinatarioFromText(text) {
  if (!text) return "No legible";
  const clean = text.replace(/\s+/g, ' ');

  if (/\b(?:perla\s*negra|ria\s*negra|negra\s*sr[li1]|perlanegra)\b/i.test(clean)) {
    return "Empresa";
  }

  const normalizarDest = (val) => {
    let limpio = val.replace(/^(?:apellido\s*y\s*nombre|titular|nombre)[:\s]*/i, '').trim();
    if (/\b(?:perla\s*negra|ria\s*negra|negra\s*sr[li1]|perlanegra)\b/i.test(limpio)) {
      return "Empresa";
    }
    return limpio;
  };

  let m = clean.match(/\bbeneficiari[oa][:s\s]+([^,]+?)(?=\s+(?:banco|cbu|cvu|cuit|cuil|\d{5,}|$))/i);
  if (m && m[1].trim().length > 2 && m[1].trim().length < 55) {
    return normalizarDest(m[1]);
  }
  m = clean.match(/cuenta\s+destino[:\s]+([^,]+?)(?=\s+(?:banco|cbu|cvu|cuit|cuil|\d{5,}|$))/i);
  if (m && m[1].trim().length > 2 && m[1].trim().length < 55) {
    return normalizarDest(m[1]);
  }
  m = clean.match(/\bpara[:\s]+([^,]+?)(?=\s+(?:banco|cbu|cvu|cuit|cuil|\d{5,}|$))/i);
  if (m && m[1].trim().length > 2 && m[1].trim().length < 55) {
    return normalizarDest(m[1]);
  }
  m = clean.match(/destinatari[oa][:s\s]+([^,]+?)(?=\s+(?:banco|cbu|cvu|cuit|cuil|\d{5,}|$))/i);
  if (m && m[1].trim().length > 2 && m[1].trim().length < 55) {
    return normalizarDest(m[1]);
  }
  m = clean.match(/transferencia\s+enviada\s+a[:\s]+([^,]+?)(?=\s+(?:banco|cbu|cvu|cuit|cuil|\$|\d{5,}|$))/i);
  if (m && m[1].trim().length > 2 && m[1].trim().length < 55) {
    return normalizarDest(m[1]);
  }
  return "No identificado";
}

function detectBancoOrigenFromText(text) {
  if (!text) return "No identificado";
  const clean = text.replace(/\s+/g, ' ');

  if (/\b(?:credicoop|banco\s*credicoop)\b/i.test(clean)) return "Banco Credicoop";
  if (/\b(?:mercado\s*pago|mercadopago)\b/i.test(clean)) return "Mercado Pago";
  if (/\b(?:naranja\s*x|naranjax|naranja\)\(|naranja\s*digital)\b/i.test(clean)) return "Naranja X";
  if (/\b(?:cuenta\s*dni|cuenta\s+comprobante|banco\s*provincia|bapro)\b/i.test(clean) || /código\s+de\s+referencia\s+\d{8}/i.test(clean)) return "Cuenta DNI";
  if (/\b(?:personal\s*pay|personalpay)\b/i.test(clean)) return "Personal Pay";
  if (/\b(?:banco\s*(?:de\s+la\s+)?naci[oó]n|bna\+?)\b/i.test(clean)) return "Banco Nación";
  if (/\bgalicia\b/i.test(clean) && !/(?:destino|beneficiario|para)[^.]*galicia/i.test(clean)) return "Galicia";
  if (/\b(?:bbva|franc[eé]s)\b/i.test(clean) && !/(?:destino|beneficiario|para)[^.]*bbva/i.test(clean)) return "BBVA";
  if (/\bbrubank\b/i.test(clean)) return "Brubank";
  if (/\bual[aá]\b/i.test(clean)) return "Ualá";
  if (/\b(?:macro\s*bma|banco\s*macro|macro\s*online)\b/i.test(clean)) return "Banco Macro";
  if (/\bpatagonia\b/i.test(clean)) return "Banco Patagonia";
  if (/\b(?:banco\s*ciudad)\b/i.test(clean)) return "Banco Ciudad";
  if (/\bcomafi\b/i.test(clean)) return "Banco Comafi";
  if (/\bsupervielle\b/i.test(clean)) return "Supervielle";

  if (/\b00000031\d{14}\b/.test(clean)) return "Mercado Pago";
  if (/\b453\d{19}\b/.test(clean)) return "Naranja X";
  if (/\b00000062\d{14}\b/.test(clean)) return "Personal Pay";
  if (/\b00000079\d{14}\b/.test(clean)) return "Ualá";

  if (/\bonline\s+banking\s+personas\b/i.test(clean) || /\bcuenta\s+d[eé]bito\b/i.test(clean) || /\bimporte\s+debitado\b/i.test(clean)) {
    return "Santander";
  }
  const sinDestino = clean.replace(/(?:beneficiario|para|destino|banco\s+de\s+destino|banco\s+destino)[^.]*(?:santander|perla\s*negra)/gi, '');
  if (/\bsantander\b/i.test(sinDestino)) {
    return "Santander";
  }
  return "No identificado";
}

function extractDateFromText(text) {
  if (!text) return "";
  const clean = text.replace(/\s+/g, ' ');

  // Buscar fechas explícitas
  // 1. Con meses en texto: 21/octubre/2026, 20/OCT/2026, etc.
  let m = clean.match(/\b(\d{1,2}[\/\s]+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-zA-Z]*[\/\s]+\d{2,4})\b/i);
  if (m) return normalizeDate(m[1]);

  // 2. Formato numérico DD/MM/AAAA o DD/MM/AA
  m = clean.match(/\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})\b/);
  if (m) return normalizeDate(m[1]);

  return "";
}

function extractRealizaFromText(text) {
  if (!text) return "";
  const clean = text.replace(/\s+/g, ' ');

  const isEmpresa = (name) => /\b(?:perla\s*negra|ria\s*negra|negra\s*sr[li1]|perlanegra)\b/i.test(name);
  const cleanName = (val) => {
    let res = val.replace(/^(?:origen\s+y\s+destino|y\s+destino|apellido\s*y\s*nombre|titular|nombre|cuenta|de|desde|origen)[:\s]*/i, '').trim();
    res = res.replace(/^(?:y\s+destino|de|desde|cuenta|origen)[:\s]*/i, '').trim();
    // quitar sufijos comunes
    res = res.replace(/\s+(?:mercado\s*pago|naranja\s*x|cuenta\s*dni|santander|banco|personal\s*pay).*$/i, '').trim();
    return res;
  };

  // 1. Mercado Pago con "Origen y destino ...":
  let m = clean.match(/origen\s+y\s+destino[:\s]+([A-Za-zÁ-ú\s]{3,45}?)(?=\s+(?:mercado\s*pago|cvu|cuit|cuil|perla|\$|$))/i);
  if (m && !isEmpresa(m[1])) {
    const res = cleanName(m[1]);
    if (res.length > 2 && !isEmpresa(res) && !/(?:comprobante|ejecuci[oó]n|plazo)/i.test(res)) return res;
  }

  // 2. Cuenta DNI: "Origen Maria Gabriela Soto 21.442.873 Para..."
  m = clean.match(/\borigen[:\s]+([A-Za-zÁ-ú\s]{3,45}?)(?=\s+(?:\d{1,2}\.\d{3}\.\d{3}|\d{7,8}|para|cbu|cvu|cuil|cuit|cuenta|banco|\$|$))/i);
  if (m && !isEmpresa(m[1])) {
    const res = cleanName(m[1]);
    if (res.length > 2 && !isEmpresa(res) && !/(?:comprobante|ejecuci[oó]n|plazo)/i.test(res)) return res;
  }

  // 3. Naranja X: "Cuenta origen Ruth Brenda Silvano Naranja X..."
  m = clean.match(/cuenta\s+origen[:\s]+([A-Za-zÁ-ú\s]{3,45}?)(?=\s+(?:naranja\s*x|cbu|cuil|cuit|cuenta\s+destino|\$|$))/i);
  if (m && !isEmpresa(m[1])) {
    const res = cleanName(m[1]);
    if (res.length > 2 && !isEmpresa(res) && !/(?:comprobante|ejecuci[oó]n|plazo)/i.test(res)) return res;
  }

  // 4. Macro: "Desde ..2554 VAZQUEZ Y RANURI ESTELLA MARIS Cuenta Banco Macro..."
  m = clean.match(/desde\s+(?:\.{1,4}\d+|\d+)?\s*([A-Za-zÁ-ú\s]{3,45}?)(?=\s+(?:cuenta|banco|cuil|cuit|monto|\$|$))/i);
  if (m && !isEmpresa(m[1])) {
    const res = cleanName(m[1]);
    if (res.length > 2 && !isEmpresa(res) && !/(?:comprobante|ejecuci[oó]n|plazo)/i.test(res)) return res;
  }

  // 5. Personal Pay / otros: "Envía JUDIT ELIZABET ESPINOZA CUIT/CUIL..."
  m = clean.match(/\b(?:env[ií]a|emisor|ordenante|titular\s+origen)[:\s]+([A-Za-zÁ-ú\s]{3,45}?)(?=\s+(?:cuit|cuil|cbu|cvu|banco|cuenta|para|destinatario|\$|$))/i);
  if (m && !isEmpresa(m[1])) {
    const res = cleanName(m[1]);
    if (res.length > 2 && !isEmpresa(res) && !/(?:comprobante|ejecuci[oó]n|plazo)/i.test(res)) return res;
  }

  // 6. Genérico: "De: Juan Perez"
  m = clean.match(/\bde[:\s]+([A-Za-zÁ-ú\s]{3,40}?)(?=\s+(?:para|a\s+la\s+cuenta|cuit|cuil|cbu|cvu|\$|$))/i);
  if (m && !isEmpresa(m[1])) {
    const res = cleanName(m[1]);
    if (res.length > 2 && !isEmpresa(res) && !/(?:comprobante|ejecuci[oó]n|plazo)/i.test(res)) return res;
  }

  // 7. Santander sin nombre: extraer cuenta débito
  m = clean.match(/cuenta\s+d[eé]bito[^\d]*(?:CTA|CC)?\s*\$?\s*([\d\/\-]+)/i);
  if (m) {
    return `Cuenta débito ${m[1]}`;
  }

  return "";
}

function extractCodigoReferenciaFromText(text) {
  if (!text) return "";
  const clean = text.replace(/\s+/g, ' ');

  // 1. Cuenta DNI: "Código de referencia 00929838"
  let m = clean.match(/c[oó]digo\s+de\s+referencia[:\s]*(\w+)/i);
  if (m) return m[1];

  // 2. Mercado Pago / general: "N.0 de operación de Mercado Pago 185396793096" o "N° de operación 3261170095"
  m = clean.match(/n[.°0ºoO]*\s+de\s+operaci[oó]n(?:\s+de\s+mercado\s+pago)?[:\s]*(\d+)/i);
  if (m) return m[1];

  // 3. Naranja X: "Código de transacción 31c40194-c999-4260-bOb7-9c4dOae78c01"
  m = clean.match(/c[oó]digo\s+de\s+transacci[oó]n[:\s]*([a-zA-Z0-9\-]+)/i);
  if (m) return m[1];

  // 4. Código de identificación / Coelsa ID / Id Bancario
  m = clean.match(/(?:id\s+bancario|coelsa\s+id|c[oó]digo\s+de\s+identificaci[oó]n)[:\s]*([a-zA-Z0-9\-]+)/i);
  if (m) return m[1];

  // 5. Santander / Online Banking: "19/10/2026 23585461 Recuerde" o "Número de comprobante ... 23585461"
  m = clean.match(/n[úu]mero\s+de\s+comprobante[^\d]*(\d{6,12})/i);
  if (m) return m[1];
  m = clean.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\s+(\d{7,10})\s+Recuerde/i);
  if (m) return m[1];

  // 6. Comprobante N° / Transacción N° / Referencia N°
  m = clean.match(/(?:comprobante|transacci[oó]n|referencia|control)[:\s]*n[.°0ºoO]*\s*(\d+)/i);
  if (m) return m[1];

  m = clean.match(/(?:comprobante|referencia|control)[:\s]*(\d{4,})/i);
  if (m) return m[1];

  return "";
}

function parseFilenameDetails(filename, defaultCampana = "") {
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext).trim();

  // Ejemplo: "C1026 6500 SOTO" o "1126 6000 ELIANA DA LUZ"
  const regex = /^([a-zA-Z]?\d{4})\s+([\d.]+)\s+(.+)$/i;
  const m = baseName.match(regex);
  if (m) {
    let impRaw = m[2].replace(/\./g, '');
    let importeNum = parseInt(impRaw, 10);
    if (isNaN(importeNum)) importeNum = m[2];

    let cod = m[1].toUpperCase();
    if (!cod.startsWith('C') && /^\d{4}$/.test(cod)) cod = 'C' + cod;

    return {
      campana: cod,
      importe: importeNum,
      revendedor: m[3].trim().toUpperCase()
    };
  }

  // Si no coincide exactamente con el formato estándar
  return {
    campana: defaultCampana || "",
    importe: "",
    revendedor: baseName
  };
}

function getLeaderFromSubfolder(relativePath) {
  // relativePath es relativo a la carpeta de la campaña, ej "C1026 TORRES/C1026 6500 SOTO.jpeg"
  const dir = path.dirname(relativePath);
  if (!dir || dir === '.' || dir === '') return "ESTEVEZ PAOLA";

  // Si dir es "C1026 TORRES", extraer "TORRES"
  const parts = dir.split(/[\\\/]/);
  const firstSub = parts[0].trim();
  // Quitar prefijo de campaña si existe tipo "C1026 "
  const cleaned = firstSub.replace(/^[a-zA-Z]\d{4}\s*[-_]?\s*/i, '').trim();
  return (cleaned || firstSub).toUpperCase() || "ESTEVEZ PAOLA";
}

async function extractPdfText(filePath) {
  try {
    const { PDFParse } = require('pdf-parse');
    const buf = fs.readFileSync(filePath);
    const parser = new PDFParse(new Uint8Array(buf));
    const result = await parser.getText();
    return result.text || '';
  } catch (e) {
    console.error(`Error leyendo PDF ${filePath}:`, e.message);
    return '';
  }
}

function runOcrOnFiles(folderPath) {
  const scriptPath = path.join(BASE_DIR, 'extract_ocr.ps1');
  try {
    const out = execFileSync('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-FolderPath', folderPath], {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 120000
    });
    const jsonStart = out.indexOf('{');
    if (jsonStart !== -1) {
      return JSON.parse(out.slice(jsonStart));
    }
  } catch (err) {
    console.warn('Error ejecutando OCR en lote:', err.message);
  }
  return {};
}

function listAllFiles(dir, extensions = ['.jpg', '.jpeg', '.png', '.pdf']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(listAllFiles(full, extensions));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) {
        results.push(full);
      }
    }
  }
  return results;
}

async function generarExcelCampana(campanaCode) {
  const normalizedCode = campanaCode.toUpperCase().trim();
  const cfg = getConfig();
  const basePath = cfg.driveBasePath;

  if (!fs.existsSync(basePath)) {
    throw new Error(`La ruta base de Drive no existe: ${basePath}`);
  }

  // Buscar carpeta de la campaña
  const entries = fs.readdirSync(basePath, { withFileTypes: true });
  let campaignFolder = null;
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const upper = entry.name.toUpperCase();
      if (upper.startsWith(normalizedCode) || upper.includes(normalizedCode)) {
        campaignFolder = path.join(basePath, entry.name);
        break;
      }
    }
  }

  if (!campaignFolder) {
    throw new Error(`No se encontró la carpeta para la campaña ${normalizedCode} en ${basePath}`);
  }

  console.log(`Procesando campaña ${normalizedCode} en: ${campaignFolder}`);
  const allFiles = listAllFiles(campaignFolder);
  console.log(`Total archivos encontrados: ${allFiles.length}`);

  const ocrCache = getOcrCache();
  let hayNuevosOcr = false;

  // Identificar si hay imágenes que necesiten OCR
  const imagenesPendientes = allFiles.filter(fp => {
    const ext = path.extname(fp).toLowerCase();
    if (ext === '.pdf') return false;
    const fname = path.basename(fp);
    return !ocrCache[fname] || !ocrCache[fname].rawText;
  });

  if (imagenesPendientes.length > 0) {
    console.log(`Ejecutando OCR sobre ${imagenesPendientes.length} imágenes nuevas/pendientes...`);
    const ocrResults = runOcrOnFiles(campaignFolder);
    for (const [fname, item] of Object.entries(ocrResults)) {
      if (item && item.rawText) {
        ocrCache[fname] = {
          rawText: item.rawText,
          destinatario: item.destinatario,
          origen: item.origen
        };
        hayNuevosOcr = true;
      }
    }
    if (hayNuevosOcr) {
      saveOcrCache(ocrCache);
    }
  } else {
    console.log(`Caché de OCR al día para todos los archivos.`);
  }

  const rows = [];
  let nro = 1;

  for (const fullPath of allFiles) {
    const fileName = path.basename(fullPath);
    const relPath = path.relative(campaignFolder, fullPath).replace(/\\/g, '/');
    const ext = path.extname(fileName).toLowerCase();

    const parsedFile = parseFilenameDetails(fileName, normalizedCode);
    const lider = getLeaderFromSubfolder(relPath);

    let rawText = "";
    if (ext === '.pdf') {
      if (ocrCache[fileName] && ocrCache[fileName].rawText) {
        rawText = ocrCache[fileName].rawText;
      } else {
        rawText = await extractPdfText(fullPath);
        ocrCache[fileName] = { rawText };
        hayNuevosOcr = true;
      }
    } else {
      const cached = ocrCache[fileName];
      if (cached && cached.rawText) {
        rawText = cached.rawText;
      }
    }

    const fecha = extractDateFromText(rawText);
    const desde = detectBancoOrigenFromText(rawText);
    const para = parseDestinatarioFromText(rawText);
    const realiza = extractRealizaFromText(rawText);
    const codigoRef = extractCodigoReferenciaFromText(rawText);

    rows.push({
      "CAMPAÑA": parsedFile.campana || normalizedCode,
      "NRO": nro++,
      "FECHA": fecha,
      "IMPORTE": parsedFile.importe,
      "LIDER": lider,
      "REVENDEDOR": parsedFile.revendedor,
      "DESDE": desde,
      "PARA": para,
      "REALIZA": realiza,
      "CODIGO DE REFERENCIA": codigoRef
    });
  }

  if (hayNuevosOcr) {
    saveOcrCache(ocrCache);
  }

  // Crear libro de trabajo Excel
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      "CAMPAÑA",
      "NRO",
      "FECHA",
      "IMPORTE",
      "LIDER",
      "REVENDEDOR",
      "DESDE",
      "PARA",
      "REALIZA",
      "CODIGO DE REFERENCIA"
    ]
  });

  // Ajustar anchos de columnas
  const colWidths = [
    { wch: 12 }, // CAMPAÑA
    { wch: 8 },  // NRO
    { wch: 14 }, // FECHA
    { wch: 14 }, // IMPORTE
    { wch: 18 }, // LIDER
    { wch: 28 }, // REVENDEDOR
    { wch: 20 }, // DESDE
    { wch: 20 }, // PARA
    { wch: 32 }, // REALIZA
    { wch: 28 }  // CODIGO DE REFERENCIA
  ];
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, normalizedCode);

  const outputFileName = `comprobantes_${normalizedCode.toLowerCase()}.xlsx`;
  const outputPath = path.join(EXCELS_DIR, outputFileName);
  XLSX.writeFile(wb, outputPath);

  console.log(`Excel generado con éxito en: ${outputPath}`);
  return {
    outputPath,
    totalProcesados: rows.length,
    rows
  };
}

module.exports = {
  generarExcelCampana,
  extractDateFromText,
  extractRealizaFromText,
  extractCodigoReferenciaFromText,
  parseFilenameDetails,
  getLeaderFromSubfolder
};

if (require.main === module) {
  const campana = process.argv[2] || 'C1026';
  generarExcelCampana(campana)
    .then(res => {
      console.log(`Proceso completado. ${res.totalProcesados} comprobantes exportados.`);
      console.log("Muestra de los primeros 5 registros:");
      console.log(res.rows.slice(0, 5));
    })
    .catch(err => {
      console.error("Error:", err);
      process.exit(1);
    });
}
