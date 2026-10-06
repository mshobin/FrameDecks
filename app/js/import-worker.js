/* BSF Command Center - reads an Excel (.xlsx/.xls) or CSV file in the background, so the window never freezes.
 * In:  {buffer: ArrayBuffer, name: string}
 * Out: {ok, sheets, sheet, headerRow, headers, rows}  (rows = arrays of cell text below the header row)
 */
importScripts('../vendor/xlsx.full.min.js');

var MAX_ROWS = 5000;

function cellText(v){
  if (v == null) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return String(v).replace(/\r\n?/g, '\n').trim();
}

self.onmessage = function(e){
  try {
    var wb = XLSX.read(new Uint8Array(e.data.buffer), {type: 'array', cellDates: false, raw: false, codepage: 65001});
    // Use the first sheet that has a table (the template's instructions sheet is skipped)
    var pick = null, best = null;
    wb.SheetNames.forEach(function(n){
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[n], {header: 1, defval: '', blankrows: true, raw: false});   // keep empty rows: row numbers must match Excel
      if (/^how to|instructions?$/i.test(n.trim())) return;
      if (!pick && rows.length) { pick = n; best = rows; }
    });
    if (!pick) { self.postMessage({ok: false, error: 'The file has no rows to import.'}); return; }
    // The header row: the first of the first 10 rows with at least two filled cells
    var hr = 0;
    for (var i = 0; i < Math.min(10, best.length); i++){
      var filled = best[i].filter(function(c){ return cellText(c) !== ''; }).length;
      if (filled >= 2){ hr = i; break; }
    }
    var start = XLSX.utils.decode_range(wb.Sheets[pick]['!ref'] || 'A1').s.r;      // first used row (0-based)
    var headers = best[hr].map(function(h, j){ return cellText(h) || ('Column ' + (j + 1)); });
    var rows = best.slice(hr + 1, hr + 1 + MAX_ROWS).map(function(r){
      var out = []; for (var j = 0; j < headers.length; j++) out.push(cellText(r[j])); return out;
    });
    self.postMessage({ok: true, sheets: wb.SheetNames, sheet: pick, headerRow: start + hr + 1, headers: headers, rows: rows,
                      truncated: best.length - hr - 1 > MAX_ROWS});
  } catch (err){
    self.postMessage({ok: false, error: 'This file could not be read (' + (err && err.message || err) + '). Save it as .xlsx or .csv and try again.'});
  }
};
