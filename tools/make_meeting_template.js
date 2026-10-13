// Writes docs/templates/Kingdom-Connect-Meeting-Template.xlsx: the same workbook as Studio → + Scene → Download the
// Excel template (both come from app/js/meeting-sheet.js). Run: node tools/make_meeting_template.js
global.window = {}; global.document = {addEventListener(){}, hidden: false}; global.location = {protocol: 'file:', search: ''};
const path = require('path'), fs = require('fs'), root = path.join(__dirname, '..');
require(path.join(root, 'app/js/store.js'));
require(path.join(root, 'app/js/meeting-sheet.js'));
const X = require(path.join(root, 'app/vendor/xlsx.full.min.js'));
const out = path.join(root, 'docs/templates/Kingdom-Connect-Meeting-Template.xlsx');
fs.writeFileSync(out, X.write(window.BSFMeetingSheet.templateBook(X, {}), {type: 'buffer', bookType: 'xlsx'}));
console.log('wrote', out);
