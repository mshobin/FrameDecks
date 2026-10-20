/* Kingdom Connect - reads an Excel (.xlsx/.xls) or CSV file in the background, so the window never freezes.
 * In:  {buffer: ArrayBuffer, name: string}
 * Out: {ok, sheets, sheet, headerRow, headers, rows}  (rows = arrays of cell text below the header row)
 *      with {all: true}: {ok, sheets, book: {sheet name: {headers, headerRow, rows}}, grids: {sheet name: {first, rows}}}
 *      (the Meeting Workbook: older ones have one table per sheet; the 6.9 Meeting Form has several on one sheet)
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
    if (e.data.all){                                   // v6.5 Meeting Workbook: every sheet, each with its own header row
      var book = {}, grids = {};
      wb.SheetNames.forEach(function(n){
        var all = XLSX.utils.sheet_to_json(wb.Sheets[n], {header: 1, defval: '', blankrows: true, raw: false});
        if (!all.length) return;
        // 6.9 the Meeting Form is one page with several tables: the whole sheet as text (row i = Excel row first + i)
        grids[n] = {first: XLSX.utils.decode_range(wb.Sheets[n]['!ref'] || 'A1').s.r + 1,
          rows: all.slice(0, MAX_ROWS).map(function(r){ var o = []; for (var j = 0; j < r.length; j++) o.push(cellText(r[j])); return o; })};
        var hr0 = 0;
        for (var k = 0; k < Math.min(10, all.length); k++){ if (all[k].filter(function(c){ return cellText(c) !== ''; }).length >= 2){ hr0 = k; break; } }
        var st0 = XLSX.utils.decode_range(wb.Sheets[n]['!ref'] || 'A1').s.r;
        var hd = all[hr0].map(function(h, j){ return cellText(h) || ('Column ' + (j + 1)); });
        book[n] = {headers: hd, headerRow: st0 + hr0 + 1, rows: all.slice(hr0 + 1, hr0 + 1 + MAX_ROWS).map(function(r){ var o = []; for (var j = 0; j < hd.length; j++) o.push(cellText(r[j])); return o; })};
      });
      self.postMessage({ok: true, sheets: wb.SheetNames, book: book, grids: grids});
      return;
    }
    // Use the first sheet that has a table (the template's instructions sheet is skipped)
    var pick = null, best = null, want = e.data.want ? String(e.data.want).toLowerCase() : '';
    wb.SheetNames.forEach(function(n){
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[n], {header: 1, defval: '', blankrows: true, raw: false});   // keep empty rows: row numbers must match Excel
      if (/^how to|instructions?$|^read ?me$|^allowed values$/i.test(n.trim())) return;
      // v6.2 the meeting template: the first sheet whose header has the wanted column (e.g. "Scene Name")
      if (want && !rows.slice(0, 10).some(function(r){ return r.some(function(c){ return cellText(c).toLowerCase() === want; }); })) return;
      if (!pick && rows.length) { pick = n; best = rows; }
    });
    if (!pick && want) { self.postMessage({ok: false, error: 'No sheet in this file has a “' + e.data.want + '” column. Use the Kingdom Connect meeting template (Download the Excel template).'}); return; }
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
