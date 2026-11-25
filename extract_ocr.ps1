param (
    [string]$FolderPath
)

if (-not (Test-Path $FolderPath)) {
    Write-Output "{}"
    exit 0
}

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1

$asTaskAction = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'
} | Select-Object -First 1

function Invoke-AsyncOp($asyncOp, $type) {
    $method = $asTaskGeneric.MakeGenericMethod($type)
    $task = $method.Invoke($null, @($asyncOp))
    $task.Wait()
    return $task.Result
}

function Invoke-AsyncAction($asyncAction) {
    $task = $asTaskAction.Invoke($null, @($asyncAction))
    $task.Wait()
}

[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType = WindowsRuntime] | Out-Null

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) {
    $langs = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages
    if ($langs.Count -gt 0) {
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($langs[0])
    }
}

function Normalize-Amount($str) {
    if (-not $str) { return $null }
    $cleaned = $str -replace '[^\d.,]', ''
    if ($cleaned -match '^(\d{1,3}(?:\.\d{3})+),(\d{2})$') {
        $entero = $Matches[1] -replace '\.', ''
        $centavos = $Matches[2]
        if ($centavos -eq '00') { return [double]$entero }
        return [double]"$entero.$centavos"
    }
    if ($cleaned -match '^(\d{1,3}(?:\.\d{3})+)$') {
        return [double]($Matches[1] -replace '\.', '')
    }
    if ($cleaned -match '^(\d+),(\d{2})$') {
        $entero = $Matches[1]
        $centavos = $Matches[2]
        if ($centavos -eq '00') { return [double]$entero }
        return [double]"$entero.$centavos"
    }
    if ($cleaned -match '^(\d+)\.(\d{2})$') {
        $entero = $Matches[1]
        $centavos = $Matches[2]
        if ($centavos -eq '00') { return [double]$entero }
        return [double]"$entero.$centavos"
    }
    if ($cleaned -match '^\d+$') {
        return [double]$cleaned
    }
    return $null
}

function Extract-AmountFromText($text) {
    if (-not $text) { return $null }
    $clean = $text -replace '\s+', ' '

    # 1. Patrones explícitos con palabras clave
    if ($clean -match '(?i)(?:importe\s*total|importe\s*debitado|monto|enviaste|transferiste|importe)[:\s]*[\$sS]?\s*([\d.,]+)') {
        $n = Normalize-Amount $Matches[1]
        if ($n -and $n -gt 0) { return $n }
    }

    # 2. Mercado Pago: "$ 114.400 Motivo:" o similar
    if ($clean -match '(?i)[\$s]\s*([\d]{1,3}(?:\.[\d]{3})+(?:,[\d]{2})?)\s*(?:motivo|para|origen|\.)') {
        $n = Normalize-Amount $Matches[1]
        if ($n -and $n -gt 0) { return $n }
    }

    # 3. $ seguido de miles con punto
    if ($clean -match '[\$s]\s*([\d]{1,3}(?:\.[\d]{3})+(?:,[\d]{2})?)') {
        $n = Normalize-Amount $Matches[1]
        if ($n -and $n -gt 0) { return $n }
    }

    # 4. $ seguido de números de al menos 4 cifras
    if ($clean -match '[\$s]\s*(\d{4,}(?:,[\d]{2})?)') {
        $n = Normalize-Amount $Matches[1]
        if ($n -and $n -gt 0) { return $n }
    }

    return $null
}

function Detect-BancoOrigen($text) {
    if (-not $text) { return "No identificado" }
    $clean = $text -replace '\s+', ' '

    # 1. Bancos y Billeteras específicas de origen
    if ($clean -match '(?i)\b(?:credicoop|banco\s*credicoop)\b') { return "Banco Credicoop" }
    if ($clean -match '(?i)\b(?:mercado\s*pago|mercadopago)\b') { return "Mercado Pago" }
    if ($clean -match '(?i)\b(?:naranja\s*x|naranjax|naranja\)\(|naranja\s*digital)\b') { return "Naranja X" }
    if ($clean -match '(?i)\b(?:cuenta\s*dni|cuenta\s+comprobante|banco\s*provincia|bapro)\b' -or $clean -match '(?i)código\s+de\s+referencia\s+\d{8}') { return "Cuenta DNI" }
    if ($clean -match '(?i)\b(?:personal\s*pay|personalpay)\b') { return "Personal Pay" }
    if ($clean -match '(?i)\b(?:banco\s*(?:de\s+la\s+)?naci[oó]n|bna\+?)\b') { return "Banco Nación" }
    if ($clean -match '(?i)\bgalicia\b' -and $clean -notmatch '(?i)(?:destino|beneficiario|para)[^.]*galicia') { return "Galicia" }
    if ($clean -match '(?i)\b(?:bbva|franc[eé]s)\b' -and $clean -notmatch '(?i)(?:destino|beneficiario|para)[^.]*bbva') { return "BBVA" }
    if ($clean -match '(?i)\bbrubank\b') { return "Brubank" }
    if ($clean -match '(?i)\bual[aá]\b') { return "Ualá" }
    if ($clean -match '(?i)\b(?:macro\s*bma|banco\s*macro|macro\s*online)\b') { return "Banco Macro" }
    if ($clean -match '(?i)\bpatagonia\b') { return "Banco Patagonia" }
    if ($clean -match '(?i)\b(?:banco\s*ciudad)\b') { return "Banco Ciudad" }
    if ($clean -match '(?i)\bcomafi\b') { return "Banco Comafi" }
    if ($clean -match '(?i)\bsupervielle\b') { return "Supervielle" }

    # 2. Búsqueda por CBU / CVU de origen en el texto
    if ($clean -match '\b00000031\d{14}\b') { return "Mercado Pago" }
    if ($clean -match '\b453\d{19}\b') { return "Naranja X" }
    if ($clean -match '\b00000062\d{14}\b') { return "Personal Pay" }
    if ($clean -match '\b00000079\d{14}\b') { return "Ualá" }

    # 3. Santander SOLO si es el emisor y no el destino de Perla Negra
    if ($clean -match '(?i)\bonline\s+banking\s+personas\b' -or $clean -match '(?i)\bcuenta\s+d[eé]bito\b' -or $clean -match '(?i)\bimporte\s+debitado\b') {
        return "Santander"
    }

    $sinDestino = $clean -replace '(?i)(?:beneficiario|para|destino|banco\s+de\s+destino|banco\s+destino)[^.]*(?:santander|perla\s*negra)', ''
    if ($sinDestino -match '(?i)\bsantander\b') {
        return "Santander"
    }

    return "No identificado"
}

function Parse-Destinatario($text) {
    if (-not $text) { return "No legible" }
    $clean = $text -replace '\s+', ' '

    # Si contiene cualquier variación de Perla Negra, CUIT o CBU, se unifica como "Empresa"
    if ($clean -match '(?i)\b(?:perla\s*negra|ria\s*negra|negra\s*sr[li1]|perlanegra)\b' -or $clean -match '\b30-?70865775-?8\b' -or $clean -match '\b0720164220000001125540\b') {
        return "Empresa"
    }

    # 1. Regex para "Beneficiario ..."
    if ($clean -match '(?i)\bbeneficiari[oa][:s\s]+(?<dest>[^\r\n,]+?)(?=\s+(?:banco|cbu|cvu|cuit|cuil|\d{5,}|$))') {
        $val = ($Matches['dest'] -replace '(?i)^(?:apellido\s*y\s*nombre|titular|nombre)[:\s]*', '').Trim()
        if ($val -match '(?i)\b(?:perla\s*negra|ria\s*negra|negra\s*sr[li1]|perlanegra)\b') { return "Empresa" }
        if ($val.Length -gt 2 -and $val.Length -lt 55) { return $val }
    }

    # 2. Regex para "Cuenta destino ..."
    if ($clean -match '(?i)cuenta\s+destino[:\s]+(?<dest>[^\r\n,]+?)(?=\s+(?:banco|cbu|cvu|cuit|cuil|\d{5,}|$))') {
        $val = ($Matches['dest'] -replace '(?i)^(?:apellido\s*y\s*nombre|titular|nombre)[:\s]*', '').Trim()
        if ($val -match '(?i)\b(?:perla\s*negra|ria\s*negra|negra\s*sr[li1]|perlanegra)\b') { return "Empresa" }
        if ($val.Length -gt 2 -and $val.Length -lt 55) { return $val }
    }

    # 3. Regex para "Para ..."
    if ($clean -match '(?i)\bpara[:\s]+(?<dest>[^\r\n,]+?)(?=\s+(?:banco|cbu|cvu|cuit|cuil|\d{5,}|$))') {
        $val = ($Matches['dest'] -replace '(?i)^(?:apellido\s*y\s*nombre|titular|nombre)[:\s]*', '').Trim()
        if ($val -match '(?i)\b(?:perla\s*negra|ria\s*negra|negra\s*sr[li1]|perlanegra)\b') { return "Empresa" }
        if ($val.Length -gt 2 -and $val.Length -lt 55) { return $val }
    }

    # 4. Regex para "Destinatario ..."
    if ($clean -match '(?i)destinatari[oa][:s\s]+(?<dest>[^\r\n,]+?)(?=\s+(?:banco|cbu|cvu|cuit|cuil|\d{5,}|$))') {
        $val = ($Matches['dest'] -replace '(?i)^(?:apellido\s*y\s*nombre|titular|nombre)[:\s]*', '').Trim()
        if ($val -match '(?i)\b(?:perla\s*negra|ria\s*negra|negra\s*sr[li1]|perlanegra)\b') { return "Empresa" }
        if ($val.Length -gt 2 -and $val.Length -lt 55) { return $val }
    }

    # 5. Regex para "Transferencia enviada a ..."
    if ($clean -match '(?i)transferencia\s+enviada\s+a[:\s]+(?<dest>[^\r\n,]+?)(?=\s+(?:banco|cbu|cvu|cuit|cuil|\$|\d{5,}|$))') {
        $val = ($Matches['dest'] -replace '(?i)^(?:apellido\s*y\s*nombre|titular|nombre)[:\s]*', '').Trim()
        if ($val -match '(?i)\b(?:perla\s*negra|ria\s*negra|negra\s*sr[li1]|perlanegra)\b') { return "Empresa" }
        if ($val.Length -gt 2 -and $val.Length -lt 55) { return $val }
    }

    # 6. Regex para "Envío de dinero a ..."
    if ($clean -match '(?i)env[ií]o\s+de\s+dinero\s+a[:\s]+(?<dest>[^\r\n,]+?)(?=\s+(?:banco|cbu|cvu|cuit|cuil|\$|\d{5,}|$))') {
        $val = ($Matches['dest'] -replace '(?i)^(?:apellido\s*y\s*nombre|titular|nombre)[:\s]*', '').Trim()
        if ($val -match '(?i)\b(?:perla\s*negra|ria\s*negra|negra\s*sr[li1]|perlanegra)\b') { return "Empresa" }
        if ($val.Length -gt 2 -and $val.Length -lt 55) { return $val }
    }

    return "No identificado"
}

$results = @{}
$extensions = @("*.jpg", "*.jpeg", "*.png", "*.pdf")

$files = Get-ChildItem -Path $FolderPath -Include $extensions -Recurse -File -ErrorAction SilentlyContinue

foreach ($file in $files) {
    try {
        $ext = $file.Extension.ToLower()
        $rawText = ""

        if ($ext -eq ".pdf") {
            $fileOp = [Windows.Storage.StorageFile]::GetFileFromPathAsync($file.FullName)
            $storageFile = Invoke-AsyncOp $fileOp ([Windows.Storage.StorageFile])
            $docOp = [Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($storageFile)
            $doc = Invoke-AsyncOp $docOp ([Windows.Data.Pdf.PdfDocument])
            if ($doc.PageCount -gt 0) {
                $page = $doc.GetPage(0)
                $memStream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
                $renderOp = $page.RenderToStreamAsync($memStream)
                Invoke-AsyncAction $renderOp

                $decoderOp = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($memStream)
                $decoder = Invoke-AsyncOp $decoderOp ([Windows.Graphics.Imaging.BitmapDecoder])
                $bitmapOp = $decoder.GetSoftwareBitmapAsync()
                $bitmap = Invoke-AsyncOp $bitmapOp ([Windows.Graphics.Imaging.SoftwareBitmap])
                $ocrOp = $engine.RecognizeAsync($bitmap)
                $ocrResult = Invoke-AsyncOp $ocrOp ([Windows.Media.Ocr.OcrResult])
                $rawText = $ocrResult.Text
            }
        } else {
            $fileOp = [Windows.Storage.StorageFile]::GetFileFromPathAsync($file.FullName)
            $storageFile = Invoke-AsyncOp $fileOp ([Windows.Storage.StorageFile])
            $streamOp = $storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)
            $stream = Invoke-AsyncOp $streamOp ([Windows.Storage.Streams.IRandomAccessStream])
            $decoderOp = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
            $decoder = Invoke-AsyncOp $decoderOp ([Windows.Graphics.Imaging.BitmapDecoder])
            $bitmapOp = $decoder.GetSoftwareBitmapAsync()
            $bitmap = Invoke-AsyncOp $bitmapOp ([Windows.Graphics.Imaging.SoftwareBitmap])
            $ocrOp = $engine.RecognizeAsync($bitmap)
            $ocrResult = Invoke-AsyncOp $ocrOp ([Windows.Media.Ocr.OcrResult])
            $rawText = $ocrResult.Text
        }

        $dest = Parse-Destinatario $rawText
        $origen = Detect-BancoOrigen $rawText
        $montoDoc = Extract-AmountFromText $rawText

        $results[$file.Name] = @{
            destinatario = $dest
            origen = $origen
            montoDoc = $montoDoc
            rawText = $rawText
        }
    } catch {
        $results[$file.Name] = @{
            destinatario = "Pendiente de sincronizar"
            origen = "Pendiente de sincronizar"
            montoDoc = $null
            rawText = ""
        }
    }
}

$json = $results | ConvertTo-Json -Compress
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Output $json
