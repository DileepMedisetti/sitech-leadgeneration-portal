/**
 * Client-side genuine Microsoft Excel (.xlsx) generator using OpenXML and pure JavaScript ZIP container.
 * Zero external runtime dependencies.
 * Fully compatible with Microsoft Excel, LibreOffice, Google Sheets, and openpyxl.
 */

const textEncoder = new TextEncoder();

function makeCrcTable() {
  let c;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Creates an uncompressed (Store, compression method 0) ZIP archive as a Uint8Array.
 * @param {Array<{ name: string, data: string | Uint8Array }>} files
 * @returns {Uint8Array}
 */
function createZip(files) {
  const entries = files.map((f) => {
    const dataBytes = typeof f.data === 'string' ? textEncoder.encode(f.data) : f.data;
    const nameBytes = textEncoder.encode(f.name);
    const crc = crc32(dataBytes);
    return { nameBytes, dataBytes, crc, size: dataBytes.length, offset: 0 };
  });

  let totalLocalSize = 0;
  for (const entry of entries) {
    entry.offset = totalLocalSize;
    totalLocalSize += 30 + entry.nameBytes.length + entry.size;
  }

  let totalCdSize = 0;
  for (const entry of entries) {
    totalCdSize += 46 + entry.nameBytes.length;
  }

  const totalZipSize = totalLocalSize + totalCdSize + 22;
  const out = new Uint8Array(totalZipSize);
  const view = new DataView(out.buffer);

  // 1. Write local file headers and data
  let pos = 0;
  for (const entry of entries) {
    view.setUint32(pos, 0x04034b50, true);                  // signature
    view.setUint16(pos + 4, 20, true);                      // version needed (2.0)
    view.setUint16(pos + 6, 0x0800, true);                  // general purpose bit flag (UTF-8)
    view.setUint16(pos + 8, 0, true);                       // compression method: 0 (stored)
    view.setUint16(pos + 10, 0, true);                      // last mod time
    view.setUint16(pos + 12, 0, true);                      // last mod date
    view.setUint32(pos + 14, entry.crc, true);              // crc-32
    view.setUint32(pos + 18, entry.size, true);             // compressed size
    view.setUint32(pos + 22, entry.size, true);             // uncompressed size
    view.setUint16(pos + 26, entry.nameBytes.length, true); // filename length
    view.setUint16(pos + 28, 0, true);                      // extra field length
    pos += 30;

    out.set(entry.nameBytes, pos);
    pos += entry.nameBytes.length;

    out.set(entry.dataBytes, pos);
    pos += entry.size;
  }

  // 2. Write central directory records
  const cdOffset = pos;
  for (const entry of entries) {
    view.setUint32(pos, 0x02014b50, true);                  // central file header signature
    view.setUint16(pos + 4, 20, true);                      // version made by
    view.setUint16(pos + 6, 20, true);                      // version needed
    view.setUint16(pos + 8, 0x0800, true);                  // UTF-8 flag
    view.setUint16(pos + 10, 0, true);                      // compression: 0
    view.setUint16(pos + 12, 0, true);                      // mod time
    view.setUint16(pos + 14, 0, true);                      // mod date
    view.setUint32(pos + 16, entry.crc, true);              // crc-32
    view.setUint32(pos + 20, entry.size, true);             // compressed size
    view.setUint32(pos + 24, entry.size, true);             // uncompressed size
    view.setUint16(pos + 28, entry.nameBytes.length, true); // filename length
    view.setUint16(pos + 30, 0, true);                      // extra field length
    view.setUint16(pos + 32, 0, true);                      // comment length
    view.setUint16(pos + 34, 0, true);                      // disk number start
    view.setUint16(pos + 36, 0, true);                      // internal file attributes
    view.setUint32(pos + 38, 0, true);                      // external file attributes
    view.setUint32(pos + 42, entry.offset, true);           // relative offset of local header
    pos += 46;

    out.set(entry.nameBytes, pos);
    pos += entry.nameBytes.length;
  }

  const cdSize = pos - cdOffset;

  // 3. Write End of Central Directory record
  view.setUint32(pos, 0x06054b50, true);                    // EOCD signature
  view.setUint16(pos + 4, 0, true);                         // disk number
  view.setUint16(pos + 6, 0, true);                         // disk with CD
  view.setUint16(pos + 8, entries.length, true);           // records on this disk
  view.setUint16(pos + 10, entries.length, true);          // total records
  view.setUint32(pos + 12, cdSize, true);                   // central directory size
  view.setUint32(pos + 16, cdOffset, true);                 // offset of central directory
  view.setUint16(pos + 20, 0, true);                        // comment length

  return out;
}

function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formula injection protection: Prefix sensitive leading symbols with single quote.
 */
export function sanitizeCellValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return val;
  const raw = String(val);
  if (raw && ['=', '+', '-', '@', '\t', '\r'].includes(raw[0])) {
    return `'${raw}`;
  }
  const text = raw.trim();
  if (text && ['=', '+', '-', '@'].includes(text[0])) {
    return `'${text}`;
  }
  return text;
}

function formatUtcDateTime(val) {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toISOString().replace('T', ' ').substring(0, 19);
  } catch {
    return String(val);
  }
}

function getColumnLetter(colIndex) {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Generates a genuine OpenXML Microsoft Excel (.xlsx) Blob for stored search/extraction results.
 * Matches backend styling: Segoe UI, monochrome dark header, zebra rows, borders, alignments, and widths.
 *
 * @param {Array<object>} results List of SearchResult objects
 * @returns {Blob}
 */
export function generateSearchResultsExcelBlob(results) {
  const headers = [
    'Result ID',
    'Search Job ID',
    'Target Webpage URL',
    'Webpage Title',
    'Status',
    'Retry Count',
    'Extraction Details',
    'Associated Lead ID',
    'Processed At (UTC)',
    'Created At (UTC)',
  ];

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Stored Extraction Results" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><name val="Segoe UI"/><sz val="10"/><color rgb="FF18181B"/></font>
    <font><name val="Segoe UI"/><sz val="11"/><b/><color rgb="FFFFFFFF"/></font>
    <font><name val="Segoe UI"/><sz val="10"/><color rgb="FF18181B"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF18181B"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE4E4E7"/></left>
      <right style="thin"><color rgb="FFE4E4E7"/></right>
      <top style="thin"><color rgb="FFE4E4E7"/></top>
      <bottom style="thin"><color rgb="FFE4E4E7"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <!-- 1: Header center align -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 2: Odd row left align -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 3: Even row zebra left align -->
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 4: Odd row center align -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- 5: Even row zebra center align -->
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

  // Prepare row values
  const rows = results.map((r) => {
    const details = r.error_message || (r.status === 'processed' ? 'Contact details verified & saved' : 'Awaiting parser');
    const statusLabel = r.status ? (r.status.charAt(0).toUpperCase() + r.status.slice(1)) : '';
    return [
      r.id,
      r.search_job_id,
      r.result_url || '',
      r.result_title || '',
      statusLabel,
      r.retry_count || 0,
      details,
      r.lead_id || '',
      formatUtcDateTime(r.processed_at),
      formatUtcDateTime(r.created_at),
    ];
  });

  // Calculate dynamic column widths based on longest cell content
  const colLengths = headers.map((h) => h.length);
  rows.forEach((row) => {
    row.forEach((val, colIdx) => {
      const len = String(val || '').length;
      if (len > colLengths[colIdx]) {
        colLengths[colIdx] = len;
      }
    });
  });

  let colsXml = '<cols>';
  colLengths.forEach((maxLen, colIdx) => {
    const width = Math.max(12, Math.min(60, maxLen + 3));
    colsXml += `<col min="${colIdx + 1}" max="${colIdx + 1}" width="${width}" customWidth="1"/>`;
  });
  colsXml += '</cols>';

  // Build sheet data
  let sheetData = '<sheetData>';

  // Row 1: Header
  sheetData += '<row r="1" ht="28" customHeight="1">';
  headers.forEach((h, colIdx) => {
    const colLetter = getColumnLetter(colIdx);
    sheetData += `<c r="${colLetter}1" t="inlineStr" s="1"><is><t>${escapeXml(h)}</t></is></c>`;
  });
  sheetData += '</row>';

  // Rows 2..N: Data rows
  rows.forEach((row, rowIdx) => {
    const rNum = rowIdx + 2;
    const isEven = (rNum % 2 === 0);

    sheetData += `<row r="${rNum}" ht="22" customHeight="1">`;
    row.forEach((val, colIdx) => {
      const colLetter = getColumnLetter(colIdx);
      const sanitized = sanitizeCellValue(val);
      // Center aligned columns: Result ID, Job ID, Status, Retry Count, Lead ID, Processed At, Created At
      const isCenter = [0, 1, 4, 5, 7, 8, 9].includes(colIdx);
      const styleId = isCenter ? (isEven ? '5' : '4') : (isEven ? '3' : '2');

      if (typeof sanitized === 'number') {
        sheetData += `<c r="${colLetter}${rNum}" s="${styleId}"><v>${sanitized}</v></c>`;
      } else {
        sheetData += `<c r="${colLetter}${rNum}" t="inlineStr" s="${styleId}"><is><t>${escapeXml(sanitized)}</t></is></c>`;
      }
    });
    sheetData += '</row>';
  });

  sheetData += '</sheetData>';

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0" showGridLines="1"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  ${colsXml}
  ${sheetData}
</worksheet>`;

  const zipBytes = createZip([
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: rootRelsXml },
    { name: 'xl/workbook.xml', data: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRelsXml },
    { name: 'xl/styles.xml', data: stylesXml },
    { name: 'xl/worksheets/sheet1.xml', data: sheet1Xml },
  ]);

  return new Blob([zipBytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generates a genuine OpenXML Microsoft Excel (.xlsx) Blob for leads.
 * Matches backend styling: Segoe UI, executive slate header (#1E293B), zebra rows, borders, alignments, and widths.
 *
 * @param {Array<object>} leads List of Lead objects
 * @returns {Blob}
 */
export function isGenericHomepage(url) {
  if (!url || typeof url !== 'string') return true;
  try {
    const parsed = new URL(url.trim());
    const path = parsed.pathname.replace(/\/+$/, '').toLowerCase();
    if (['', '/index.html', '/index.htm', '/index.php', '/home', '/home.html', '/default.aspx'].includes(path)) {
      if (!parsed.search && !parsed.hash) return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function generateLeadsExcelBlob(leads) {
  const headers = [
    'Name',
    'Email',
    'Designation / Role',
    'Specialization / Profession',
    'University / Institution',
    'Country',
    'LinkedIn URL',
    'Institutional Webpage / Source URL',
    'Lead ID',
    'Department',
    'Phone Number',
    'Source URL',
    'Qualification Status',
    'Confidence Score',
    'Qualification Reason',
    'Search Job ID',
    'Created At (UTC)',
  ];

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sitech Verified Leads" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><name val="Segoe UI"/><sz val="10"/><color rgb="FF0F172A"/></font>
    <font><name val="Segoe UI"/><sz val="11"/><b/><color rgb="FFFFFFFF"/></font>
    <font><name val="Segoe UI"/><sz val="10"/><color rgb="FF0F172A"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE2E8F0"/></left>
      <right style="thin"><color rgb="FFE2E8F0"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <!-- 1: Header center align -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 2: Odd row left align -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 3: Even row zebra left align -->
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 4: Odd row center align -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- 5: Even row zebra center align -->
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

  // Prepare row values
  const rows = leads.map((lead) => {
    let confStr = '';
    if (lead.confidence_score !== null && lead.confidence_score !== undefined && lead.confidence_score !== '') {
      const num = Number(lead.confidence_score);
      if (Number.isFinite(num)) {
        const pct = Math.round(num <= 1.0 ? num * 100 : num);
        confStr = `${pct}%`;
      }
    }

    const statusTitle = lead.qualification_status
      ? lead.qualification_status.charAt(0).toUpperCase() + lead.qualification_status.slice(1)
      : '';

    const verUrl = (lead.website && !isGenericHomepage(lead.website))
      ? lead.website
      : (lead.source_url && !isGenericHomepage(lead.source_url) ? lead.source_url : '');

    return [
      lead.name || '',
      lead.email || '',
      lead.profession || '',
      lead.research_specialization || '',
      lead.university || '',
      lead.country || '',
      lead.linkedin_url || '',
      verUrl,
      lead.id,
      lead.department || '',
      lead.phone_number || '',
      lead.source_url || '',
      statusTitle,
      confStr,
      lead.qualification_reason || '',
      lead.search_job_id || '',
      formatUtcDateTime(lead.created_at),
    ];
  });

  // Calculate dynamic column widths based on longest cell content
  const colLengths = headers.map((h) => h.length);
  rows.forEach((row) => {
    row.forEach((val, colIdx) => {
      const len = String(val || '').length;
      if (len > colLengths[colIdx]) {
        colLengths[colIdx] = len;
      }
    });
  });

  let colsXml = '<cols>';
  colLengths.forEach((maxLen, colIdx) => {
    const width = Math.max(12, Math.min(50, maxLen + 3));
    colsXml += `<col min="${colIdx + 1}" max="${colIdx + 1}" width="${width}" customWidth="1"/>`;
  });
  colsXml += '</cols>';

  // Build sheet data
  let sheetData = '<sheetData>';

  // Row 1: Header
  sheetData += '<row r="1" ht="28" customHeight="1">';
  headers.forEach((h, colIdx) => {
    const colLetter = getColumnLetter(colIdx);
    sheetData += `<c r="${colLetter}1" t="inlineStr" s="1"><is><t>${escapeXml(h)}</t></is></c>`;
  });
  sheetData += '</row>';

  // Rows 2..N: Data rows
  rows.forEach((row, rowIdx) => {
    const rNum = rowIdx + 2;
    const isEven = (rNum % 2 === 0);

    sheetData += `<row r="${rNum}" ht="22" customHeight="1">`;
    row.forEach((val, colIdx) => {
      const colLetter = getColumnLetter(colIdx);
      const sanitized = sanitizeCellValue(val);
      // Center aligned columns: Country (5), Lead ID (8), Status (12), Confidence (13), Search Job ID (15), Created At (16)
      const isCenter = [5, 8, 12, 13, 15, 16].includes(colIdx);
      const styleId = isCenter ? (isEven ? '5' : '4') : (isEven ? '3' : '2');

      if (typeof sanitized === 'number') {
        sheetData += `<c r="${colLetter}${rNum}" s="${styleId}"><v>${sanitized}</v></c>`;
      } else {
        sheetData += `<c r="${colLetter}${rNum}" t="inlineStr" s="${styleId}"><is><t>${escapeXml(sanitized)}</t></is></c>`;
      }
    });
    sheetData += '</row>';
  });

  sheetData += '</sheetData>';

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0" showGridLines="1"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  ${colsXml}
  ${sheetData}
</worksheet>`;

  const zipBytes = createZip([
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: rootRelsXml },
    { name: 'xl/workbook.xml', data: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRelsXml },
    { name: 'xl/styles.xml', data: stylesXml },
    { name: 'xl/worksheets/sheet1.xml', data: sheet1Xml },
  ]);

  return new Blob([zipBytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
