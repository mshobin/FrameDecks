import 'dart:typed_data';

import 'package:excel/excel.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../core/security/permissions.dart';
import '../../data/models/meeting.dart';
import '../../data/models/records.dart';

/// What an export may contain (docs/project/flutter-platform-plan.md §2, "export controls").
class ExportOptions {
  const ExportOptions({this.includePersonalData = true, this.includePrivatePrayer = false});

  /// Phone numbers, e-mail addresses and birthdays of volunteers.
  final bool includePersonalData;

  /// Prayer requests marked private.
  final bool includePrivatePrayer;

  /// Narrows the options to what [user] may export under [policy].
  ExportOptions allowedFor(AppUser user, PermissionPolicy policy) => ExportOptions(
        includePersonalData: includePersonalData && policy.can(user, Permission.exportPersonalData),
        includePrivatePrayer: includePrivatePrayer && policy.can(user, Permission.viewPrivatePrayer),
      );
}

final _day = DateFormat('yyyy-MM-dd');
String _d(DateTime? d) => d == null ? '' : _day.format(d);

/// One Excel workbook with a clean table per record type (for reports, not for editing).
Uint8List exportWorkbook({
  required List<Meeting> meetings,
  required List<FollowUp> followUps,
  required List<PrayerRequest> prayer,
  required List<Volunteer> volunteers,
  required Map<String, String> ministryNames,
  ExportOptions options = const ExportOptions(),
}) {
  final book = Excel.createExcel();
  final header = CellStyle(bold: true, backgroundColorHex: ExcelColor.fromHexString('#0F1F3D'),
      fontColorHex: ExcelColor.white);

  void sheet(String name, List<String> columns, List<List<Object?>> rows) {
    final s = book[name];
    s.appendRow(columns.map<CellValue?>(TextCellValue.new).toList());
    for (var c = 0; c < columns.length; c++) {
      s.cell(CellIndex.indexByColumnRow(columnIndex: c, rowIndex: 0)).cellStyle = header;
      s.setColumnWidth(c, 18);
    }
    for (final r in rows) {
      s.appendRow(r.map<CellValue?>((v) => v is int ? IntCellValue(v) : TextCellValue('${v ?? ''}')).toList());
    }
  }

  sheet('Meetings', [
    'Date', 'Meeting', 'Ministry', 'Time', 'Location', 'Speaker', 'Attendance', 'Visitors', 'New members',
    'Decisions', 'Open action items',
  ], [
    for (final m in [...meetings]..sort((a, b) => (b.date ?? DateTime(0)).compareTo(a.date ?? DateTime(0))))
      [
        _d(m.date), m.name, ministryNames[m.ministryUid] ?? '', m.startTime, m.location, m.speaker, m.attendance.count,
        m.attendance.visitors, m.attendance.newMembers, m.discussion.decisions,
        m.actionItems.where((a) => a.status != ActionStatus.done).length,
      ]
  ]);
  sheet('Action items', ['Meeting', 'Action', 'Owner', 'Due', 'Status'], [
    for (final m in meetings)
      for (final a in m.actionItems) [m.name, a.title, a.owner, _d(a.dueDate), a.status.name]
  ]);
  sheet('Follow-ups', ['Person', if (options.includePersonalData) 'Contact', 'Reason', 'Assigned to', 'Due', 'Status'], [
    for (final f in followUps)
      [f.personName, if (options.includePersonalData) f.contact, f.reason, f.assignedTo, _d(f.dueDate), f.status.name]
  ]);
  sheet('Prayer requests', ['Request', 'Details', 'Requested by', 'Status', 'Date'], [
    for (final p in prayer.where((p) => options.includePrivatePrayer || !p.isPrivate))
      [p.title, p.details, p.requestedBy, p.status.name, _d(p.createdAt)]
  ]);
  sheet('Volunteers', [
    'Name', 'Roles', if (options.includePersonalData) ...['Phone', 'E-mail', 'Birthday'], 'Active',
  ], [
    for (final v in volunteers)
      [
        v.name, v.roles.join(', '), if (options.includePersonalData) ...[v.phone, v.email, v.birthDate],
        v.active ? 'Yes' : 'No',
      ]
  ]);
  book.delete('Sheet1');
  return Uint8List.fromList(book.encode()!);
}

/// A one-page meeting summary (to print or share with the leadership team).
Future<Uint8List> exportMeetingPdf(Meeting m, {String ministry = '', String church = ''}) async {
  final navy = PdfColor.fromHex('#0F1F3D'), gold = PdfColor.fromHex('#E3B75A');
  final doc = pw.Document(title: m.displayTitle, creator: 'Kingdom Connect');

  pw.Widget section(String title, List<pw.Widget> body) => pw.Container(
        margin: const pw.EdgeInsets.only(top: 14),
        child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Text(title.toUpperCase(),
              style: pw.TextStyle(fontSize: 9, color: gold, fontWeight: pw.FontWeight.bold, letterSpacing: 1)),
          pw.SizedBox(height: 4),
          ...body,
        ]),
      );
  pw.Widget text(String label, String value) => value.trim().isEmpty
      ? pw.SizedBox()
      : pw.Padding(
          padding: const pw.EdgeInsets.only(bottom: 4),
          child: pw.RichText(
              text: pw.TextSpan(children: [
            pw.TextSpan(text: '$label  ', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, color: navy)),
            pw.TextSpan(text: value),
          ])));

  doc.addPage(pw.MultiPage(
    pageFormat: PdfPageFormat.a4,
    margin: const pw.EdgeInsets.all(40),
    header: (_) => pw.Container(
      padding: const pw.EdgeInsets.only(bottom: 8),
      decoration: pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: gold, width: 1.5))),
      child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
        pw.Text(church.isEmpty ? 'KINGDOM CONNECT' : church.toUpperCase(),
            style: pw.TextStyle(color: navy, fontWeight: pw.FontWeight.bold, letterSpacing: 1.5)),
        pw.Text('Meeting summary', style: const pw.TextStyle(color: PdfColors.grey700)),
      ]),
    ),
    build: (_) => [
      pw.SizedBox(height: 12),
      pw.Text(m.displayTitle, style: pw.TextStyle(fontSize: 22, fontWeight: pw.FontWeight.bold, color: navy)),
      pw.Text([ministry, _d(m.date), m.startTime, m.location].where((s) => s.isNotEmpty).join('  ·  '),
          style: const pw.TextStyle(color: PdfColors.grey700)),
      section('Attendees', [
        pw.Text('${m.attendance.count} attended  ·  ${m.attendance.visitors} visitors  ·  '
            '${m.attendance.newMembers} new members'),
        text('Notes', m.attendance.notes),
      ]),
      section('Discussion', [
        text('Agenda', m.discussion.agenda),
        text('Notes', m.discussion.notes),
        text('Decisions', m.discussion.decisions),
      ]),
      if (m.actionItems.isNotEmpty)
        section('Action items', [
          pw.TableHelper.fromTextArray(
            headers: ['Action', 'Owner', 'Due', 'Status'],
            data: [for (final a in m.actionItems) [a.title, a.owner, _d(a.dueDate), a.status.name]],
            headerStyle: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold),
            headerDecoration: pw.BoxDecoration(color: navy),
            cellAlignment: pw.Alignment.centerLeft,
          ),
        ]),
      section('Spiritual outcomes', [
        text('Prayer requests', m.spiritual.prayerRequests),
        text('Testimonies', m.spiritual.testimonies),
        text('Follow-ups', m.spiritual.followUps),
      ]),
    ],
  ));
  return doc.save();
}
