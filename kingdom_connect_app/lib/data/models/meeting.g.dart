// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'meeting.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetMeetingCollection on Isar {
  IsarCollection<Meeting> get meetings => this.collection();
}

const MeetingSchema = CollectionSchema(
  name: r'Meeting',
  id: -5591494224190015019,
  properties: {
    r'actionItems': PropertySchema(
      id: 0,
      name: r'actionItems',
      type: IsarType.objectList,

      target: r'ActionItem',
    ),
    r'attendance': PropertySchema(
      id: 1,
      name: r'attendance',
      type: IsarType.object,

      target: r'MeetingAttendance',
    ),
    r'createdAt': PropertySchema(
      id: 2,
      name: r'createdAt',
      type: IsarType.dateTime,
    ),
    r'date': PropertySchema(id: 3, name: r'date', type: IsarType.dateTime),
    r'deletedAt': PropertySchema(
      id: 4,
      name: r'deletedAt',
      type: IsarType.dateTime,
    ),
    r'dirty': PropertySchema(id: 5, name: r'dirty', type: IsarType.bool),
    r'discussion': PropertySchema(
      id: 6,
      name: r'discussion',
      type: IsarType.object,

      target: r'MeetingDiscussion',
    ),
    r'location': PropertySchema(
      id: 7,
      name: r'location',
      type: IsarType.string,
    ),
    r'ministryUid': PropertySchema(
      id: 8,
      name: r'ministryUid',
      type: IsarType.string,
    ),
    r'name': PropertySchema(id: 9, name: r'name', type: IsarType.string),
    r'source': PropertySchema(
      id: 10,
      name: r'source',
      type: IsarType.byte,
      enumMap: _MeetingsourceEnumValueMap,
    ),
    r'speaker': PropertySchema(id: 11, name: r'speaker', type: IsarType.string),
    r'speakerContact': PropertySchema(
      id: 12,
      name: r'speakerContact',
      type: IsarType.string,
    ),
    r'spiritual': PropertySchema(
      id: 13,
      name: r'spiritual',
      type: IsarType.object,

      target: r'SpiritualOutcomes',
    ),
    r'startTime': PropertySchema(
      id: 14,
      name: r'startTime',
      type: IsarType.string,
    ),
    r'status': PropertySchema(
      id: 15,
      name: r'status',
      type: IsarType.byte,
      enumMap: _MeetingstatusEnumValueMap,
    ),
    r'uid': PropertySchema(id: 16, name: r'uid', type: IsarType.string),
    r'updatedAt': PropertySchema(
      id: 17,
      name: r'updatedAt',
      type: IsarType.dateTime,
    ),
    r'version': PropertySchema(id: 18, name: r'version', type: IsarType.long),
  },

  estimateSize: _meetingEstimateSize,
  serialize: _meetingSerialize,
  deserialize: _meetingDeserialize,
  deserializeProp: _meetingDeserializeProp,
  idName: r'id',
  indexes: {
    r'ministryUid': IndexSchema(
      id: 4989114734368745386,
      name: r'ministryUid',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'ministryUid',
          type: IndexType.hash,
          caseSensitive: true,
        ),
      ],
    ),
    r'date': IndexSchema(
      id: -7552997827385218417,
      name: r'date',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'date',
          type: IndexType.value,
          caseSensitive: false,
        ),
      ],
    ),
    r'status': IndexSchema(
      id: -107785170620420283,
      name: r'status',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'status',
          type: IndexType.value,
          caseSensitive: false,
        ),
      ],
    ),
    r'uid': IndexSchema(
      id: 8193695471701937315,
      name: r'uid',
      unique: true,
      replace: true,
      properties: [
        IndexPropertySchema(
          name: r'uid',
          type: IndexType.hash,
          caseSensitive: true,
        ),
      ],
    ),
    r'updatedAt': IndexSchema(
      id: -6238191080293565125,
      name: r'updatedAt',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'updatedAt',
          type: IndexType.value,
          caseSensitive: false,
        ),
      ],
    ),
  },
  links: {},
  embeddedSchemas: {
    r'MeetingAttendance': MeetingAttendanceSchema,
    r'MeetingDiscussion': MeetingDiscussionSchema,
    r'ActionItem': ActionItemSchema,
    r'SpiritualOutcomes': SpiritualOutcomesSchema,
  },

  getId: _meetingGetId,
  getLinks: _meetingGetLinks,
  attach: _meetingAttach,
  version: '3.3.2',
);

int _meetingEstimateSize(
  Meeting object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.actionItems.length * 3;
  {
    final offsets = allOffsets[ActionItem]!;
    for (var i = 0; i < object.actionItems.length; i++) {
      final value = object.actionItems[i];
      bytesCount += ActionItemSchema.estimateSize(value, offsets, allOffsets);
    }
  }
  bytesCount +=
      3 +
      MeetingAttendanceSchema.estimateSize(
        object.attendance,
        allOffsets[MeetingAttendance]!,
        allOffsets,
      );
  bytesCount +=
      3 +
      MeetingDiscussionSchema.estimateSize(
        object.discussion,
        allOffsets[MeetingDiscussion]!,
        allOffsets,
      );
  bytesCount += 3 + object.location.length * 3;
  {
    final value = object.ministryUid;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.name.length * 3;
  bytesCount += 3 + object.speaker.length * 3;
  bytesCount += 3 + object.speakerContact.length * 3;
  bytesCount +=
      3 +
      SpiritualOutcomesSchema.estimateSize(
        object.spiritual,
        allOffsets[SpiritualOutcomes]!,
        allOffsets,
      );
  bytesCount += 3 + object.startTime.length * 3;
  bytesCount += 3 + object.uid.length * 3;
  return bytesCount;
}

void _meetingSerialize(
  Meeting object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeObjectList<ActionItem>(
    offsets[0],
    allOffsets,
    ActionItemSchema.serialize,
    object.actionItems,
  );
  writer.writeObject<MeetingAttendance>(
    offsets[1],
    allOffsets,
    MeetingAttendanceSchema.serialize,
    object.attendance,
  );
  writer.writeDateTime(offsets[2], object.createdAt);
  writer.writeDateTime(offsets[3], object.date);
  writer.writeDateTime(offsets[4], object.deletedAt);
  writer.writeBool(offsets[5], object.dirty);
  writer.writeObject<MeetingDiscussion>(
    offsets[6],
    allOffsets,
    MeetingDiscussionSchema.serialize,
    object.discussion,
  );
  writer.writeString(offsets[7], object.location);
  writer.writeString(offsets[8], object.ministryUid);
  writer.writeString(offsets[9], object.name);
  writer.writeByte(offsets[10], object.source.index);
  writer.writeString(offsets[11], object.speaker);
  writer.writeString(offsets[12], object.speakerContact);
  writer.writeObject<SpiritualOutcomes>(
    offsets[13],
    allOffsets,
    SpiritualOutcomesSchema.serialize,
    object.spiritual,
  );
  writer.writeString(offsets[14], object.startTime);
  writer.writeByte(offsets[15], object.status.index);
  writer.writeString(offsets[16], object.uid);
  writer.writeDateTime(offsets[17], object.updatedAt);
  writer.writeLong(offsets[18], object.version);
}

Meeting _meetingDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = Meeting();
  object.actionItems =
      reader.readObjectList<ActionItem>(
        offsets[0],
        ActionItemSchema.deserialize,
        allOffsets,
        ActionItem(),
      ) ??
      [];
  object.attendance =
      reader.readObjectOrNull<MeetingAttendance>(
        offsets[1],
        MeetingAttendanceSchema.deserialize,
        allOffsets,
      ) ??
      MeetingAttendance();
  object.createdAt = reader.readDateTime(offsets[2]);
  object.date = reader.readDateTimeOrNull(offsets[3]);
  object.deletedAt = reader.readDateTimeOrNull(offsets[4]);
  object.dirty = reader.readBool(offsets[5]);
  object.discussion =
      reader.readObjectOrNull<MeetingDiscussion>(
        offsets[6],
        MeetingDiscussionSchema.deserialize,
        allOffsets,
      ) ??
      MeetingDiscussion();
  object.id = id;
  object.location = reader.readString(offsets[7]);
  object.ministryUid = reader.readStringOrNull(offsets[8]);
  object.name = reader.readString(offsets[9]);
  object.source =
      _MeetingsourceValueEnumMap[reader.readByteOrNull(offsets[10])] ??
      MeetingSource.app;
  object.speaker = reader.readString(offsets[11]);
  object.speakerContact = reader.readString(offsets[12]);
  object.spiritual =
      reader.readObjectOrNull<SpiritualOutcomes>(
        offsets[13],
        SpiritualOutcomesSchema.deserialize,
        allOffsets,
      ) ??
      SpiritualOutcomes();
  object.startTime = reader.readString(offsets[14]);
  object.status =
      _MeetingstatusValueEnumMap[reader.readByteOrNull(offsets[15])] ??
      MeetingStatus.draft;
  object.uid = reader.readString(offsets[16]);
  object.updatedAt = reader.readDateTime(offsets[17]);
  object.version = reader.readLong(offsets[18]);
  return object;
}

P _meetingDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readObjectList<ActionItem>(
                offset,
                ActionItemSchema.deserialize,
                allOffsets,
                ActionItem(),
              ) ??
              [])
          as P;
    case 1:
      return (reader.readObjectOrNull<MeetingAttendance>(
                offset,
                MeetingAttendanceSchema.deserialize,
                allOffsets,
              ) ??
              MeetingAttendance())
          as P;
    case 2:
      return (reader.readDateTime(offset)) as P;
    case 3:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 4:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 5:
      return (reader.readBool(offset)) as P;
    case 6:
      return (reader.readObjectOrNull<MeetingDiscussion>(
                offset,
                MeetingDiscussionSchema.deserialize,
                allOffsets,
              ) ??
              MeetingDiscussion())
          as P;
    case 7:
      return (reader.readString(offset)) as P;
    case 8:
      return (reader.readStringOrNull(offset)) as P;
    case 9:
      return (reader.readString(offset)) as P;
    case 10:
      return (_MeetingsourceValueEnumMap[reader.readByteOrNull(offset)] ??
              MeetingSource.app)
          as P;
    case 11:
      return (reader.readString(offset)) as P;
    case 12:
      return (reader.readString(offset)) as P;
    case 13:
      return (reader.readObjectOrNull<SpiritualOutcomes>(
                offset,
                SpiritualOutcomesSchema.deserialize,
                allOffsets,
              ) ??
              SpiritualOutcomes())
          as P;
    case 14:
      return (reader.readString(offset)) as P;
    case 15:
      return (_MeetingstatusValueEnumMap[reader.readByteOrNull(offset)] ??
              MeetingStatus.draft)
          as P;
    case 16:
      return (reader.readString(offset)) as P;
    case 17:
      return (reader.readDateTime(offset)) as P;
    case 18:
      return (reader.readLong(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

const _MeetingsourceEnumValueMap = {
  'app': 0,
  'windowsImport': 1,
  'workbook': 2,
};
const _MeetingsourceValueEnumMap = {
  0: MeetingSource.app,
  1: MeetingSource.windowsImport,
  2: MeetingSource.workbook,
};
const _MeetingstatusEnumValueMap = {'draft': 0, 'planned': 1, 'held': 2};
const _MeetingstatusValueEnumMap = {
  0: MeetingStatus.draft,
  1: MeetingStatus.planned,
  2: MeetingStatus.held,
};

Id _meetingGetId(Meeting object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _meetingGetLinks(Meeting object) {
  return [];
}

void _meetingAttach(IsarCollection<dynamic> col, Id id, Meeting object) {
  object.id = id;
}

extension MeetingByIndex on IsarCollection<Meeting> {
  Future<Meeting?> getByUid(String uid) {
    return getByIndex(r'uid', [uid]);
  }

  Meeting? getByUidSync(String uid) {
    return getByIndexSync(r'uid', [uid]);
  }

  Future<bool> deleteByUid(String uid) {
    return deleteByIndex(r'uid', [uid]);
  }

  bool deleteByUidSync(String uid) {
    return deleteByIndexSync(r'uid', [uid]);
  }

  Future<List<Meeting?>> getAllByUid(List<String> uidValues) {
    final values = uidValues.map((e) => [e]).toList();
    return getAllByIndex(r'uid', values);
  }

  List<Meeting?> getAllByUidSync(List<String> uidValues) {
    final values = uidValues.map((e) => [e]).toList();
    return getAllByIndexSync(r'uid', values);
  }

  Future<int> deleteAllByUid(List<String> uidValues) {
    final values = uidValues.map((e) => [e]).toList();
    return deleteAllByIndex(r'uid', values);
  }

  int deleteAllByUidSync(List<String> uidValues) {
    final values = uidValues.map((e) => [e]).toList();
    return deleteAllByIndexSync(r'uid', values);
  }

  Future<Id> putByUid(Meeting object) {
    return putByIndex(r'uid', object);
  }

  Id putByUidSync(Meeting object, {bool saveLinks = true}) {
    return putByIndexSync(r'uid', object, saveLinks: saveLinks);
  }

  Future<List<Id>> putAllByUid(List<Meeting> objects) {
    return putAllByIndex(r'uid', objects);
  }

  List<Id> putAllByUidSync(List<Meeting> objects, {bool saveLinks = true}) {
    return putAllByIndexSync(r'uid', objects, saveLinks: saveLinks);
  }
}

extension MeetingQueryWhereSort on QueryBuilder<Meeting, Meeting, QWhere> {
  QueryBuilder<Meeting, Meeting, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhere> anyDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        const IndexWhereClause.any(indexName: r'date'),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhere> anyStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        const IndexWhereClause.any(indexName: r'status'),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhere> anyUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        const IndexWhereClause.any(indexName: r'updatedAt'),
      );
    });
  }
}

extension MeetingQueryWhere on QueryBuilder<Meeting, Meeting, QWhereClause> {
  QueryBuilder<Meeting, Meeting, QAfterWhereClause> idEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(lower: id, upper: id));
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> idNotEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(
              IdWhereClause.lessThan(upper: id, includeUpper: false),
            )
            .addWhereClause(
              IdWhereClause.greaterThan(lower: id, includeLower: false),
            );
      } else {
        return query
            .addWhereClause(
              IdWhereClause.greaterThan(lower: id, includeLower: false),
            )
            .addWhereClause(
              IdWhereClause.lessThan(upper: id, includeUpper: false),
            );
      }
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> idGreaterThan(
    Id id, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> idLessThan(
    Id id, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> idBetween(
    Id lowerId,
    Id upperId, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.between(
          lower: lowerId,
          includeLower: includeLower,
          upper: upperId,
          includeUpper: includeUpper,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> ministryUidIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.equalTo(indexName: r'ministryUid', value: [null]),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> ministryUidIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.between(
          indexName: r'ministryUid',
          lower: [null],
          includeLower: false,
          upper: [],
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> ministryUidEqualTo(
    String? ministryUid,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.equalTo(
          indexName: r'ministryUid',
          value: [ministryUid],
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> ministryUidNotEqualTo(
    String? ministryUid,
  ) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'ministryUid',
                lower: [],
                upper: [ministryUid],
                includeUpper: false,
              ),
            )
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'ministryUid',
                lower: [ministryUid],
                includeLower: false,
                upper: [],
              ),
            );
      } else {
        return query
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'ministryUid',
                lower: [ministryUid],
                includeLower: false,
                upper: [],
              ),
            )
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'ministryUid',
                lower: [],
                upper: [ministryUid],
                includeUpper: false,
              ),
            );
      }
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> dateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.equalTo(indexName: r'date', value: [null]),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> dateIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.between(
          indexName: r'date',
          lower: [null],
          includeLower: false,
          upper: [],
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> dateEqualTo(
    DateTime? date,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.equalTo(indexName: r'date', value: [date]),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> dateNotEqualTo(
    DateTime? date,
  ) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'date',
                lower: [],
                upper: [date],
                includeUpper: false,
              ),
            )
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'date',
                lower: [date],
                includeLower: false,
                upper: [],
              ),
            );
      } else {
        return query
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'date',
                lower: [date],
                includeLower: false,
                upper: [],
              ),
            )
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'date',
                lower: [],
                upper: [date],
                includeUpper: false,
              ),
            );
      }
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> dateGreaterThan(
    DateTime? date, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.between(
          indexName: r'date',
          lower: [date],
          includeLower: include,
          upper: [],
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> dateLessThan(
    DateTime? date, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.between(
          indexName: r'date',
          lower: [],
          upper: [date],
          includeUpper: include,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> dateBetween(
    DateTime? lowerDate,
    DateTime? upperDate, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.between(
          indexName: r'date',
          lower: [lowerDate],
          includeLower: includeLower,
          upper: [upperDate],
          includeUpper: includeUpper,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> statusEqualTo(
    MeetingStatus status,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.equalTo(indexName: r'status', value: [status]),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> statusNotEqualTo(
    MeetingStatus status,
  ) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'status',
                lower: [],
                upper: [status],
                includeUpper: false,
              ),
            )
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'status',
                lower: [status],
                includeLower: false,
                upper: [],
              ),
            );
      } else {
        return query
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'status',
                lower: [status],
                includeLower: false,
                upper: [],
              ),
            )
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'status',
                lower: [],
                upper: [status],
                includeUpper: false,
              ),
            );
      }
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> statusGreaterThan(
    MeetingStatus status, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.between(
          indexName: r'status',
          lower: [status],
          includeLower: include,
          upper: [],
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> statusLessThan(
    MeetingStatus status, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.between(
          indexName: r'status',
          lower: [],
          upper: [status],
          includeUpper: include,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> statusBetween(
    MeetingStatus lowerStatus,
    MeetingStatus upperStatus, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.between(
          indexName: r'status',
          lower: [lowerStatus],
          includeLower: includeLower,
          upper: [upperStatus],
          includeUpper: includeUpper,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> uidEqualTo(String uid) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.equalTo(indexName: r'uid', value: [uid]),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> uidNotEqualTo(String uid) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'uid',
                lower: [],
                upper: [uid],
                includeUpper: false,
              ),
            )
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'uid',
                lower: [uid],
                includeLower: false,
                upper: [],
              ),
            );
      } else {
        return query
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'uid',
                lower: [uid],
                includeLower: false,
                upper: [],
              ),
            )
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'uid',
                lower: [],
                upper: [uid],
                includeUpper: false,
              ),
            );
      }
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> updatedAtEqualTo(
    DateTime updatedAt,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.equalTo(indexName: r'updatedAt', value: [updatedAt]),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> updatedAtNotEqualTo(
    DateTime updatedAt,
  ) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'updatedAt',
                lower: [],
                upper: [updatedAt],
                includeUpper: false,
              ),
            )
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'updatedAt',
                lower: [updatedAt],
                includeLower: false,
                upper: [],
              ),
            );
      } else {
        return query
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'updatedAt',
                lower: [updatedAt],
                includeLower: false,
                upper: [],
              ),
            )
            .addWhereClause(
              IndexWhereClause.between(
                indexName: r'updatedAt',
                lower: [],
                upper: [updatedAt],
                includeUpper: false,
              ),
            );
      }
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> updatedAtGreaterThan(
    DateTime updatedAt, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.between(
          indexName: r'updatedAt',
          lower: [updatedAt],
          includeLower: include,
          upper: [],
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> updatedAtLessThan(
    DateTime updatedAt, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.between(
          indexName: r'updatedAt',
          lower: [],
          upper: [updatedAt],
          includeUpper: include,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterWhereClause> updatedAtBetween(
    DateTime lowerUpdatedAt,
    DateTime upperUpdatedAt, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IndexWhereClause.between(
          indexName: r'updatedAt',
          lower: [lowerUpdatedAt],
          includeLower: includeLower,
          upper: [upperUpdatedAt],
          includeUpper: includeUpper,
        ),
      );
    });
  }
}

extension MeetingQueryFilter
    on QueryBuilder<Meeting, Meeting, QFilterCondition> {
  QueryBuilder<Meeting, Meeting, QAfterFilterCondition>
  actionItemsLengthEqualTo(int length) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(r'actionItems', length, true, length, true);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> actionItemsIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(r'actionItems', 0, true, 0, true);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition>
  actionItemsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(r'actionItems', 0, false, 999999, true);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition>
  actionItemsLengthLessThan(int length, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(r'actionItems', 0, true, length, include);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition>
  actionItemsLengthGreaterThan(int length, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(r'actionItems', length, include, 999999, true);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition>
  actionItemsLengthBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'actionItems',
        lower,
        includeLower,
        upper,
        includeUpper,
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> createdAtEqualTo(
    DateTime value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'createdAt', value: value),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> createdAtGreaterThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'createdAt',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> createdAtLessThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'createdAt',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> createdAtBetween(
    DateTime lower,
    DateTime upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'createdAt',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> dateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const FilterCondition.isNull(property: r'date'),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> dateIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const FilterCondition.isNotNull(property: r'date'),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> dateEqualTo(
    DateTime? value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'date', value: value),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> dateGreaterThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'date',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> dateLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'date',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> dateBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'date',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> deletedAtIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const FilterCondition.isNull(property: r'deletedAt'),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> deletedAtIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const FilterCondition.isNotNull(property: r'deletedAt'),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> deletedAtEqualTo(
    DateTime? value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'deletedAt', value: value),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> deletedAtGreaterThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'deletedAt',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> deletedAtLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'deletedAt',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> deletedAtBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'deletedAt',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> dirtyEqualTo(
    bool value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'dirty', value: value),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> idEqualTo(Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'id', value: value),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> idGreaterThan(
    Id value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'id',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> idLessThan(
    Id value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'id',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> idBetween(
    Id lower,
    Id upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'id',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> locationEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(
          property: r'location',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> locationGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'location',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> locationLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'location',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> locationBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'location',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> locationStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.startsWith(
          property: r'location',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> locationEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.endsWith(
          property: r'location',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> locationContains(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.contains(
          property: r'location',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> locationMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.matches(
          property: r'location',
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> locationIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'location', value: ''),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> locationIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(property: r'location', value: ''),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> ministryUidIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const FilterCondition.isNull(property: r'ministryUid'),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> ministryUidIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const FilterCondition.isNotNull(property: r'ministryUid'),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> ministryUidEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(
          property: r'ministryUid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> ministryUidGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'ministryUid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> ministryUidLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'ministryUid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> ministryUidBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'ministryUid',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> ministryUidStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.startsWith(
          property: r'ministryUid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> ministryUidEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.endsWith(
          property: r'ministryUid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> ministryUidContains(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.contains(
          property: r'ministryUid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> ministryUidMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.matches(
          property: r'ministryUid',
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> ministryUidIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'ministryUid', value: ''),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition>
  ministryUidIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(property: r'ministryUid', value: ''),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> nameEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(
          property: r'name',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> nameGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'name',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> nameLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'name',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> nameBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'name',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> nameStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.startsWith(
          property: r'name',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> nameEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.endsWith(
          property: r'name',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> nameContains(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.contains(
          property: r'name',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> nameMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.matches(
          property: r'name',
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> nameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'name', value: ''),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> nameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(property: r'name', value: ''),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> sourceEqualTo(
    MeetingSource value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'source', value: value),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> sourceGreaterThan(
    MeetingSource value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'source',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> sourceLessThan(
    MeetingSource value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'source',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> sourceBetween(
    MeetingSource lower,
    MeetingSource upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'source',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> speakerEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(
          property: r'speaker',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> speakerGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'speaker',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> speakerLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'speaker',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> speakerBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'speaker',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> speakerStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.startsWith(
          property: r'speaker',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> speakerEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.endsWith(
          property: r'speaker',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> speakerContains(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.contains(
          property: r'speaker',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> speakerMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.matches(
          property: r'speaker',
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> speakerIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'speaker', value: ''),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> speakerIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(property: r'speaker', value: ''),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> speakerContactEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(
          property: r'speakerContact',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition>
  speakerContactGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'speakerContact',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> speakerContactLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'speakerContact',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> speakerContactBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'speakerContact',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition>
  speakerContactStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.startsWith(
          property: r'speakerContact',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> speakerContactEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.endsWith(
          property: r'speakerContact',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> speakerContactContains(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.contains(
          property: r'speakerContact',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> speakerContactMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.matches(
          property: r'speakerContact',
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition>
  speakerContactIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'speakerContact', value: ''),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition>
  speakerContactIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(property: r'speakerContact', value: ''),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> startTimeEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(
          property: r'startTime',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> startTimeGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'startTime',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> startTimeLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'startTime',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> startTimeBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'startTime',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> startTimeStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.startsWith(
          property: r'startTime',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> startTimeEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.endsWith(
          property: r'startTime',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> startTimeContains(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.contains(
          property: r'startTime',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> startTimeMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.matches(
          property: r'startTime',
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> startTimeIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'startTime', value: ''),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> startTimeIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(property: r'startTime', value: ''),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> statusEqualTo(
    MeetingStatus value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'status', value: value),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> statusGreaterThan(
    MeetingStatus value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'status',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> statusLessThan(
    MeetingStatus value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'status',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> statusBetween(
    MeetingStatus lower,
    MeetingStatus upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'status',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> uidEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(
          property: r'uid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> uidGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'uid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> uidLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'uid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> uidBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'uid',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> uidStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.startsWith(
          property: r'uid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> uidEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.endsWith(
          property: r'uid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> uidContains(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.contains(
          property: r'uid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> uidMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.matches(
          property: r'uid',
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> uidIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'uid', value: ''),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> uidIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(property: r'uid', value: ''),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> updatedAtEqualTo(
    DateTime value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'updatedAt', value: value),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> updatedAtGreaterThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'updatedAt',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> updatedAtLessThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'updatedAt',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> updatedAtBetween(
    DateTime lower,
    DateTime upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'updatedAt',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> versionEqualTo(
    int value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'version', value: value),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> versionGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'version',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> versionLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'version',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> versionBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'version',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
        ),
      );
    });
  }
}

extension MeetingQueryObject
    on QueryBuilder<Meeting, Meeting, QFilterCondition> {
  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> actionItemsElement(
    FilterQuery<ActionItem> q,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.object(q, r'actionItems');
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> attendance(
    FilterQuery<MeetingAttendance> q,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.object(q, r'attendance');
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> discussion(
    FilterQuery<MeetingDiscussion> q,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.object(q, r'discussion');
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterFilterCondition> spiritual(
    FilterQuery<SpiritualOutcomes> q,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.object(q, r'spiritual');
    });
  }
}

extension MeetingQueryLinks
    on QueryBuilder<Meeting, Meeting, QFilterCondition> {}

extension MeetingQuerySortBy on QueryBuilder<Meeting, Meeting, QSortBy> {
  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'date', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'date', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByDeletedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'deletedAt', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByDeletedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'deletedAt', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByDirty() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dirty', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByDirtyDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dirty', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByLocation() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'location', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByLocationDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'location', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByMinistryUid() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'ministryUid', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByMinistryUidDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'ministryUid', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'name', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'name', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortBySource() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'source', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortBySourceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'source', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortBySpeaker() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'speaker', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortBySpeakerDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'speaker', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortBySpeakerContact() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'speakerContact', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortBySpeakerContactDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'speakerContact', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByStartTime() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'startTime', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByStartTimeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'startTime', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByUid() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'uid', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByUidDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'uid', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'version', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> sortByVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'version', Sort.desc);
    });
  }
}

extension MeetingQuerySortThenBy
    on QueryBuilder<Meeting, Meeting, QSortThenBy> {
  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'date', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'date', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByDeletedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'deletedAt', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByDeletedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'deletedAt', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByDirty() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dirty', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByDirtyDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dirty', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByLocation() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'location', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByLocationDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'location', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByMinistryUid() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'ministryUid', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByMinistryUidDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'ministryUid', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'name', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'name', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenBySource() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'source', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenBySourceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'source', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenBySpeaker() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'speaker', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenBySpeakerDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'speaker', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenBySpeakerContact() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'speakerContact', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenBySpeakerContactDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'speakerContact', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByStartTime() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'startTime', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByStartTimeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'startTime', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'status', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByUid() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'uid', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByUidDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'uid', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.desc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'version', Sort.asc);
    });
  }

  QueryBuilder<Meeting, Meeting, QAfterSortBy> thenByVersionDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'version', Sort.desc);
    });
  }
}

extension MeetingQueryWhereDistinct
    on QueryBuilder<Meeting, Meeting, QDistinct> {
  QueryBuilder<Meeting, Meeting, QDistinct> distinctByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'createdAt');
    });
  }

  QueryBuilder<Meeting, Meeting, QDistinct> distinctByDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'date');
    });
  }

  QueryBuilder<Meeting, Meeting, QDistinct> distinctByDeletedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'deletedAt');
    });
  }

  QueryBuilder<Meeting, Meeting, QDistinct> distinctByDirty() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'dirty');
    });
  }

  QueryBuilder<Meeting, Meeting, QDistinct> distinctByLocation({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'location', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<Meeting, Meeting, QDistinct> distinctByMinistryUid({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'ministryUid', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<Meeting, Meeting, QDistinct> distinctByName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'name', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<Meeting, Meeting, QDistinct> distinctBySource() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'source');
    });
  }

  QueryBuilder<Meeting, Meeting, QDistinct> distinctBySpeaker({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'speaker', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<Meeting, Meeting, QDistinct> distinctBySpeakerContact({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(
        r'speakerContact',
        caseSensitive: caseSensitive,
      );
    });
  }

  QueryBuilder<Meeting, Meeting, QDistinct> distinctByStartTime({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'startTime', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<Meeting, Meeting, QDistinct> distinctByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'status');
    });
  }

  QueryBuilder<Meeting, Meeting, QDistinct> distinctByUid({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'uid', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<Meeting, Meeting, QDistinct> distinctByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'updatedAt');
    });
  }

  QueryBuilder<Meeting, Meeting, QDistinct> distinctByVersion() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'version');
    });
  }
}

extension MeetingQueryProperty
    on QueryBuilder<Meeting, Meeting, QQueryProperty> {
  QueryBuilder<Meeting, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<Meeting, List<ActionItem>, QQueryOperations>
  actionItemsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'actionItems');
    });
  }

  QueryBuilder<Meeting, MeetingAttendance, QQueryOperations>
  attendanceProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'attendance');
    });
  }

  QueryBuilder<Meeting, DateTime, QQueryOperations> createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'createdAt');
    });
  }

  QueryBuilder<Meeting, DateTime?, QQueryOperations> dateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'date');
    });
  }

  QueryBuilder<Meeting, DateTime?, QQueryOperations> deletedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'deletedAt');
    });
  }

  QueryBuilder<Meeting, bool, QQueryOperations> dirtyProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'dirty');
    });
  }

  QueryBuilder<Meeting, MeetingDiscussion, QQueryOperations>
  discussionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'discussion');
    });
  }

  QueryBuilder<Meeting, String, QQueryOperations> locationProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'location');
    });
  }

  QueryBuilder<Meeting, String?, QQueryOperations> ministryUidProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'ministryUid');
    });
  }

  QueryBuilder<Meeting, String, QQueryOperations> nameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'name');
    });
  }

  QueryBuilder<Meeting, MeetingSource, QQueryOperations> sourceProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'source');
    });
  }

  QueryBuilder<Meeting, String, QQueryOperations> speakerProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'speaker');
    });
  }

  QueryBuilder<Meeting, String, QQueryOperations> speakerContactProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'speakerContact');
    });
  }

  QueryBuilder<Meeting, SpiritualOutcomes, QQueryOperations>
  spiritualProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'spiritual');
    });
  }

  QueryBuilder<Meeting, String, QQueryOperations> startTimeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'startTime');
    });
  }

  QueryBuilder<Meeting, MeetingStatus, QQueryOperations> statusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'status');
    });
  }

  QueryBuilder<Meeting, String, QQueryOperations> uidProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'uid');
    });
  }

  QueryBuilder<Meeting, DateTime, QQueryOperations> updatedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'updatedAt');
    });
  }

  QueryBuilder<Meeting, int, QQueryOperations> versionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'version');
    });
  }
}

// **************************************************************************
// IsarEmbeddedGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

const MeetingAttendanceSchema = Schema(
  name: r'MeetingAttendance',
  id: 1524441055286530713,
  properties: {
    r'count': PropertySchema(id: 0, name: r'count', type: IsarType.long),
    r'newMembers': PropertySchema(
      id: 1,
      name: r'newMembers',
      type: IsarType.long,
    ),
    r'notes': PropertySchema(id: 2, name: r'notes', type: IsarType.string),
    r'visitors': PropertySchema(id: 3, name: r'visitors', type: IsarType.long),
  },

  estimateSize: _meetingAttendanceEstimateSize,
  serialize: _meetingAttendanceSerialize,
  deserialize: _meetingAttendanceDeserialize,
  deserializeProp: _meetingAttendanceDeserializeProp,
);

int _meetingAttendanceEstimateSize(
  MeetingAttendance object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.notes.length * 3;
  return bytesCount;
}

void _meetingAttendanceSerialize(
  MeetingAttendance object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeLong(offsets[0], object.count);
  writer.writeLong(offsets[1], object.newMembers);
  writer.writeString(offsets[2], object.notes);
  writer.writeLong(offsets[3], object.visitors);
}

MeetingAttendance _meetingAttendanceDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = MeetingAttendance();
  object.count = reader.readLong(offsets[0]);
  object.newMembers = reader.readLong(offsets[1]);
  object.notes = reader.readString(offsets[2]);
  object.visitors = reader.readLong(offsets[3]);
  return object;
}

P _meetingAttendanceDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readLong(offset)) as P;
    case 1:
      return (reader.readLong(offset)) as P;
    case 2:
      return (reader.readString(offset)) as P;
    case 3:
      return (reader.readLong(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

extension MeetingAttendanceQueryFilter
    on QueryBuilder<MeetingAttendance, MeetingAttendance, QFilterCondition> {
  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  countEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'count', value: value),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  countGreaterThan(int value, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'count',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  countLessThan(int value, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'count',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  countBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'count',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
        ),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  newMembersEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'newMembers', value: value),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  newMembersGreaterThan(int value, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'newMembers',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  newMembersLessThan(int value, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'newMembers',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  newMembersBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'newMembers',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
        ),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  notesEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(
          property: r'notes',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  notesGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'notes',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  notesLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'notes',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  notesBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'notes',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  notesStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.startsWith(
          property: r'notes',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  notesEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.endsWith(
          property: r'notes',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  notesContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.contains(
          property: r'notes',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  notesMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.matches(
          property: r'notes',
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  notesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'notes', value: ''),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  notesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(property: r'notes', value: ''),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  visitorsEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'visitors', value: value),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  visitorsGreaterThan(int value, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'visitors',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  visitorsLessThan(int value, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'visitors',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<MeetingAttendance, MeetingAttendance, QAfterFilterCondition>
  visitorsBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'visitors',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
        ),
      );
    });
  }
}

extension MeetingAttendanceQueryObject
    on QueryBuilder<MeetingAttendance, MeetingAttendance, QFilterCondition> {}

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

const MeetingDiscussionSchema = Schema(
  name: r'MeetingDiscussion',
  id: 6960343599246868194,
  properties: {
    r'agenda': PropertySchema(id: 0, name: r'agenda', type: IsarType.string),
    r'decisions': PropertySchema(
      id: 1,
      name: r'decisions',
      type: IsarType.string,
    ),
    r'notes': PropertySchema(id: 2, name: r'notes', type: IsarType.string),
  },

  estimateSize: _meetingDiscussionEstimateSize,
  serialize: _meetingDiscussionSerialize,
  deserialize: _meetingDiscussionDeserialize,
  deserializeProp: _meetingDiscussionDeserializeProp,
);

int _meetingDiscussionEstimateSize(
  MeetingDiscussion object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.agenda.length * 3;
  bytesCount += 3 + object.decisions.length * 3;
  bytesCount += 3 + object.notes.length * 3;
  return bytesCount;
}

void _meetingDiscussionSerialize(
  MeetingDiscussion object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeString(offsets[0], object.agenda);
  writer.writeString(offsets[1], object.decisions);
  writer.writeString(offsets[2], object.notes);
}

MeetingDiscussion _meetingDiscussionDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = MeetingDiscussion();
  object.agenda = reader.readString(offsets[0]);
  object.decisions = reader.readString(offsets[1]);
  object.notes = reader.readString(offsets[2]);
  return object;
}

P _meetingDiscussionDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readString(offset)) as P;
    case 1:
      return (reader.readString(offset)) as P;
    case 2:
      return (reader.readString(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

extension MeetingDiscussionQueryFilter
    on QueryBuilder<MeetingDiscussion, MeetingDiscussion, QFilterCondition> {
  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  agendaEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(
          property: r'agenda',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  agendaGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'agenda',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  agendaLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'agenda',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  agendaBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'agenda',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  agendaStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.startsWith(
          property: r'agenda',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  agendaEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.endsWith(
          property: r'agenda',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  agendaContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.contains(
          property: r'agenda',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  agendaMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.matches(
          property: r'agenda',
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  agendaIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'agenda', value: ''),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  agendaIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(property: r'agenda', value: ''),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  decisionsEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(
          property: r'decisions',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  decisionsGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'decisions',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  decisionsLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'decisions',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  decisionsBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'decisions',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  decisionsStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.startsWith(
          property: r'decisions',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  decisionsEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.endsWith(
          property: r'decisions',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  decisionsContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.contains(
          property: r'decisions',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  decisionsMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.matches(
          property: r'decisions',
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  decisionsIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'decisions', value: ''),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  decisionsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(property: r'decisions', value: ''),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  notesEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(
          property: r'notes',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  notesGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'notes',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  notesLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'notes',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  notesBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'notes',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  notesStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.startsWith(
          property: r'notes',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  notesEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.endsWith(
          property: r'notes',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  notesContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.contains(
          property: r'notes',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  notesMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.matches(
          property: r'notes',
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  notesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'notes', value: ''),
      );
    });
  }

  QueryBuilder<MeetingDiscussion, MeetingDiscussion, QAfterFilterCondition>
  notesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(property: r'notes', value: ''),
      );
    });
  }
}

extension MeetingDiscussionQueryObject
    on QueryBuilder<MeetingDiscussion, MeetingDiscussion, QFilterCondition> {}

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

const ActionItemSchema = Schema(
  name: r'ActionItem',
  id: 1916725859023885483,
  properties: {
    r'dueDate': PropertySchema(
      id: 0,
      name: r'dueDate',
      type: IsarType.dateTime,
    ),
    r'owner': PropertySchema(id: 1, name: r'owner', type: IsarType.string),
    r'status': PropertySchema(
      id: 2,
      name: r'status',
      type: IsarType.byte,
      enumMap: _ActionItemstatusEnumValueMap,
    ),
    r'title': PropertySchema(id: 3, name: r'title', type: IsarType.string),
    r'uid': PropertySchema(id: 4, name: r'uid', type: IsarType.string),
  },

  estimateSize: _actionItemEstimateSize,
  serialize: _actionItemSerialize,
  deserialize: _actionItemDeserialize,
  deserializeProp: _actionItemDeserializeProp,
);

int _actionItemEstimateSize(
  ActionItem object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.owner.length * 3;
  bytesCount += 3 + object.title.length * 3;
  bytesCount += 3 + object.uid.length * 3;
  return bytesCount;
}

void _actionItemSerialize(
  ActionItem object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeDateTime(offsets[0], object.dueDate);
  writer.writeString(offsets[1], object.owner);
  writer.writeByte(offsets[2], object.status.index);
  writer.writeString(offsets[3], object.title);
  writer.writeString(offsets[4], object.uid);
}

ActionItem _actionItemDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = ActionItem();
  object.dueDate = reader.readDateTimeOrNull(offsets[0]);
  object.owner = reader.readString(offsets[1]);
  object.status =
      _ActionItemstatusValueEnumMap[reader.readByteOrNull(offsets[2])] ??
      ActionStatus.open;
  object.title = reader.readString(offsets[3]);
  object.uid = reader.readString(offsets[4]);
  return object;
}

P _actionItemDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readDateTimeOrNull(offset)) as P;
    case 1:
      return (reader.readString(offset)) as P;
    case 2:
      return (_ActionItemstatusValueEnumMap[reader.readByteOrNull(offset)] ??
              ActionStatus.open)
          as P;
    case 3:
      return (reader.readString(offset)) as P;
    case 4:
      return (reader.readString(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

const _ActionItemstatusEnumValueMap = {'open': 0, 'inProgress': 1, 'done': 2};
const _ActionItemstatusValueEnumMap = {
  0: ActionStatus.open,
  1: ActionStatus.inProgress,
  2: ActionStatus.done,
};

extension ActionItemQueryFilter
    on QueryBuilder<ActionItem, ActionItem, QFilterCondition> {
  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> dueDateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const FilterCondition.isNull(property: r'dueDate'),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition>
  dueDateIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const FilterCondition.isNotNull(property: r'dueDate'),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> dueDateEqualTo(
    DateTime? value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'dueDate', value: value),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition>
  dueDateGreaterThan(DateTime? value, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'dueDate',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> dueDateLessThan(
    DateTime? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'dueDate',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> dueDateBetween(
    DateTime? lower,
    DateTime? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'dueDate',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> ownerEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(
          property: r'owner',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> ownerGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'owner',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> ownerLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'owner',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> ownerBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'owner',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> ownerStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.startsWith(
          property: r'owner',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> ownerEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.endsWith(
          property: r'owner',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> ownerContains(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.contains(
          property: r'owner',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> ownerMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.matches(
          property: r'owner',
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> ownerIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'owner', value: ''),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition>
  ownerIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(property: r'owner', value: ''),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> statusEqualTo(
    ActionStatus value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'status', value: value),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> statusGreaterThan(
    ActionStatus value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'status',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> statusLessThan(
    ActionStatus value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'status',
          value: value,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> statusBetween(
    ActionStatus lower,
    ActionStatus upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'status',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> titleEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(
          property: r'title',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> titleGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'title',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> titleLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'title',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> titleBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'title',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> titleStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.startsWith(
          property: r'title',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> titleEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.endsWith(
          property: r'title',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> titleContains(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.contains(
          property: r'title',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> titleMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.matches(
          property: r'title',
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> titleIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'title', value: ''),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition>
  titleIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(property: r'title', value: ''),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> uidEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(
          property: r'uid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> uidGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'uid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> uidLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'uid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> uidBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'uid',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> uidStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.startsWith(
          property: r'uid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> uidEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.endsWith(
          property: r'uid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> uidContains(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.contains(
          property: r'uid',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> uidMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.matches(
          property: r'uid',
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> uidIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'uid', value: ''),
      );
    });
  }

  QueryBuilder<ActionItem, ActionItem, QAfterFilterCondition> uidIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(property: r'uid', value: ''),
      );
    });
  }
}

extension ActionItemQueryObject
    on QueryBuilder<ActionItem, ActionItem, QFilterCondition> {}

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

const SpiritualOutcomesSchema = Schema(
  name: r'SpiritualOutcomes',
  id: 929340092380981618,
  properties: {
    r'followUps': PropertySchema(
      id: 0,
      name: r'followUps',
      type: IsarType.string,
    ),
    r'prayerRequests': PropertySchema(
      id: 1,
      name: r'prayerRequests',
      type: IsarType.string,
    ),
    r'testimonies': PropertySchema(
      id: 2,
      name: r'testimonies',
      type: IsarType.string,
    ),
  },

  estimateSize: _spiritualOutcomesEstimateSize,
  serialize: _spiritualOutcomesSerialize,
  deserialize: _spiritualOutcomesDeserialize,
  deserializeProp: _spiritualOutcomesDeserializeProp,
);

int _spiritualOutcomesEstimateSize(
  SpiritualOutcomes object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.followUps.length * 3;
  bytesCount += 3 + object.prayerRequests.length * 3;
  bytesCount += 3 + object.testimonies.length * 3;
  return bytesCount;
}

void _spiritualOutcomesSerialize(
  SpiritualOutcomes object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeString(offsets[0], object.followUps);
  writer.writeString(offsets[1], object.prayerRequests);
  writer.writeString(offsets[2], object.testimonies);
}

SpiritualOutcomes _spiritualOutcomesDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = SpiritualOutcomes();
  object.followUps = reader.readString(offsets[0]);
  object.prayerRequests = reader.readString(offsets[1]);
  object.testimonies = reader.readString(offsets[2]);
  return object;
}

P _spiritualOutcomesDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readString(offset)) as P;
    case 1:
      return (reader.readString(offset)) as P;
    case 2:
      return (reader.readString(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

extension SpiritualOutcomesQueryFilter
    on QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QFilterCondition> {
  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  followUpsEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(
          property: r'followUps',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  followUpsGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'followUps',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  followUpsLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'followUps',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  followUpsBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'followUps',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  followUpsStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.startsWith(
          property: r'followUps',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  followUpsEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.endsWith(
          property: r'followUps',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  followUpsContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.contains(
          property: r'followUps',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  followUpsMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.matches(
          property: r'followUps',
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  followUpsIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'followUps', value: ''),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  followUpsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(property: r'followUps', value: ''),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  prayerRequestsEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(
          property: r'prayerRequests',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  prayerRequestsGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'prayerRequests',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  prayerRequestsLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'prayerRequests',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  prayerRequestsBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'prayerRequests',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  prayerRequestsStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.startsWith(
          property: r'prayerRequests',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  prayerRequestsEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.endsWith(
          property: r'prayerRequests',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  prayerRequestsContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.contains(
          property: r'prayerRequests',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  prayerRequestsMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.matches(
          property: r'prayerRequests',
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  prayerRequestsIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'prayerRequests', value: ''),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  prayerRequestsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(property: r'prayerRequests', value: ''),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  testimoniesEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(
          property: r'testimonies',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  testimoniesGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(
          include: include,
          property: r'testimonies',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  testimoniesLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.lessThan(
          include: include,
          property: r'testimonies',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  testimoniesBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.between(
          property: r'testimonies',
          lower: lower,
          includeLower: includeLower,
          upper: upper,
          includeUpper: includeUpper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  testimoniesStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.startsWith(
          property: r'testimonies',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  testimoniesEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.endsWith(
          property: r'testimonies',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  testimoniesContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.contains(
          property: r'testimonies',
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  testimoniesMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.matches(
          property: r'testimonies',
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  testimoniesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.equalTo(property: r'testimonies', value: ''),
      );
    });
  }

  QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QAfterFilterCondition>
  testimoniesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        FilterCondition.greaterThan(property: r'testimonies', value: ''),
      );
    });
  }
}

extension SpiritualOutcomesQueryObject
    on QueryBuilder<SpiritualOutcomes, SpiritualOutcomes, QFilterCondition> {}
