/// FrameDecks's state model: a Dart port of app/js/store.js (the Windows app).
///
/// The state is the same JSON document the Windows app saves (kc-saved-content.json) and serves (api/state), kept as
/// plain maps so nothing is lost when either app reads what the other wrote. These constants mirror store.js one for
/// one; tests/parity checks the operations against the JavaScript itself.
library;

import 'dart:math';

typedef Json = Map<String, dynamic>;

const cardKinds = ['scripture', 'question', 'birthday'];
const textKinds = ['announcement', 'prayer', 'lowerthird', 'countdown', 'brand'];
const mediaKinds = ['camera', 'screen', 'window', 'image', 'video', 'pdf', 'background', 'text', 'rect', 'ellipse'];
const allKinds = [...cardKinds, ...textKinds, ...mediaKinds];

/// Content kinds: display name and the icon name the Windows app uses (Lucide).
const kindInfo = <String, ({String name, String icon})>{
  'scripture': (name: 'Scripture', icon: 'book-open'),
  'question': (name: 'Question', icon: 'message-circle'),
  'birthday': (name: 'Birthday', icon: 'cake'),
  'announcement': (name: 'Announcement', icon: 'megaphone'),
  'prayer': (name: 'Prayer Point', icon: 'heart'),
  'lowerthird': (name: 'Lower Third', icon: 'panel-bottom'),
  'countdown': (name: 'Countdown', icon: 'timer'),
  'brand': (name: 'Branding', icon: 'star'),
  'camera': (name: 'Camera', icon: 'video'),
  'screen': (name: 'Screen', icon: 'monitor'),
  'window': (name: 'Window', icon: 'app-window'),
  'image': (name: 'Image', icon: 'image'),
  'video': (name: 'Video', icon: 'film'),
  'pdf': (name: 'PowerPoint', icon: 'presentation'),
  'background': (name: 'Background', icon: 'paint-bucket'),
  'text': (name: 'Text', icon: 'type'),
  'rect': (name: 'Shape', icon: 'square'),
  'ellipse': (name: 'Ellipse', icon: 'circle'),
};

/// Frame transitions (the Transition menu in the top bar).
const transitionsList = [
  ('cut', 'Cut'),
  ('fade', 'Fade'),
  ('dissolve', 'Cross Dissolve'),
  ('dip-black', 'Dip to Black'),
  ('dip-white', 'Dip to White'),
  ('blur-fade', 'Blur Fade'),
  ('zoom-fade', 'Zoom Fade'),
  ('slide-left', 'Slide Left'),
  ('slide-right', 'Slide Right'),
  ('push', 'Push'),
  ('reveal', 'Reveal'),
  ('soft-scale', 'Soft Scale'),
  ('cinema', 'Cinema Fade'),
  ('church', 'Church Service Fade'),
];
final txIds = [for (final t in transitionsList) t.$1];
const txMs = <String, int>{
  'cut': 0,
  'fade': 500,
  'dissolve': 450,
  'dip-black': 700,
  'dip-white': 700,
  'blur-fade': 500,
  'zoom-fade': 500,
  'slide-left': 450,
  'slide-right': 450,
  'push': 450,
  'reveal': 550,
  'soft-scale': 450,
  'cinema': 1100,
  'church': 800,
};

/// Meeting profiles: the default transition of every Frame.
const profiles = [
  (id: 'sunday', name: 'Sunday Service', type: 'fade', ms: 500),
  (id: 'bible-study', name: 'Bible Study', type: 'fade', ms: 350),
  (id: 'youth', name: 'Youth Service', type: 'push', ms: 300),
  (id: 'conference', name: 'Conference', type: 'dissolve', ms: 400),
  (id: 'wedding', name: 'Wedding', type: 'cinema', ms: 1100),
  (id: 'funeral', name: 'Funeral', type: 'church', ms: 900),
  (id: 'christmas', name: 'Christmas Service', type: 'dip-white', ms: 700),
  (id: 'livestream', name: 'Livestream', type: 'cut', ms: 0),
];

/// Card animations (question and scripture cards).
const cardTransitions = ['fade', 'rise', 'words', 'typewriter', 'burst', 'none'];
const cardTransitionNames = <String, String>{
  'fade': 'Fade',
  'rise': 'Gentle rise',
  'words': 'Word by word',
  'typewriter': 'Typewriter',
  'burst': 'Burst',
  'none': 'Cut',
};
const defaultPool = ['fade', 'rise', 'words', 'burst'];
const speeds = ['slow', 'normal', 'fast'];
const presentModes = ['question', 'both', 'verse'];
const positions = ['top', 'center', 'bottom', 'lower-left', 'lower-right', 'upper-left', 'upper-right'];

/// Text Content defaults (announcement, prayer, lower third, countdown, branding).
const textDefaults = <String, Json>{
  'announcement': {'title': 'Announcement', 'text': '', 'pos': 'center', 'w': 70, 'scale': 1, 'label': true, 'anim': 'fade', 'logo': false},
  'prayer': {'title': 'Prayer Point', 'text': '', 'pos': 'center', 'w': 70, 'scale': 1, 'label': true, 'anim': 'fade', 'logo': false},
  'lowerthird': {'title': '', 'text': '', 'pos': 'lower-left', 'w': 46, 'scale': 0.9, 'label': true, 'anim': 'rise', 'logo': false},
  'countdown': {
    'title': 'Starting in',
    'text': 'Starting now',
    'mode': 'duration',
    'minutes': 5,
    'until': '10:30',
    'pos': 'center',
    'w': 36,
    'scale': 1.6,
    'label': true,
    'anim': 'fade',
    'logo': false,
  },
  'brand': {
    'title': '',
    'text': '',
    'pos': 'upper-right',
    'w': 30,
    'scale': 1,
    'label': false,
    'anim': 'fade',
    'logo': true,
    'name': true,
    'org': false,
    'plate': true,
    'pad': 1,
    'margin': 4,
  },
};
const textRange = <String, List<num>>{
  'w': [20, 96],
  'minutes': [0, 600],
  'pad': [0, 3],
  'margin': [0, 12],
};

const itemFields = <String, List<String>>{
  'question': ['label', 'text', 'answer', 'note', 'pair', 'mode', 'media', 'timer', 'anim'],
  'scripture': ['label', 'ref', 'version', 'text', 'note', 'anim'],
};

/// A Frame's own card appearance (applied when it goes live).
const look = <String, ({List<String> layout, List<String> card})>{
  'question': (layout: ['qScale', 'qWidth', 'qBottom', 'panel'], card: ['transition', 'speed', 'random', 'pool', 'burst', 'showLabel']),
  'scripture': (
    layout: ['verseScale', 'verseY', 'verseWidth', 'verseAlign', 'panel'],
    card: ['transition', 'speed', 'random', 'pool', 'burst', 'showLabel'],
  ),
};
const lookRange = <String, List<num>>{
  'qScale': [.6, 1.6],
  'qWidth': [50, 94],
  'qBottom': [4, 24],
  'panel': [50, 100],
  'verseScale': [.6, 1.6],
  'verseY': [22, 60],
  'verseWidth': [40, 88],
};
const inkTools = ['pen', 'highlighter', 'arrow', 'line', 'rect', 'ellipse', 'text'];

/// Built-in Frame templates (the + Frame menu).
const templates = [
  (id: 'bible-study', name: 'Bible Study', layers: ['scripture', 'question']),
  (id: 'scripture', name: 'Scripture', layers: ['scripture']),
  (id: 'question', name: 'Question', layers: ['question']),
  (id: 'question-scripture', name: 'Question + Scripture', layers: ['question', 'scripture']),
  (id: 'birthday', name: 'Birthday', layers: ['birthday']),
  (id: 'announcement', name: 'Announcement', layers: ['announcement']),
  (id: 'prayer', name: 'Prayer Point', layers: ['prayer', 'scripture']),
  (id: 'slides', name: 'Slides', layers: ['pdf']),
  (id: 'media', name: 'Media', layers: ['video']),
  (id: 'countdown', name: 'Countdown', layers: ['countdown']),
  (id: 'zoom', name: 'Zoom Layout', layers: ['camera']),
  (id: 'teams', name: 'Teams Layout', layers: ['camera']),
  (id: 'blank', name: 'Blank', layers: <String>[]),
];

/// The state a new Windows install starts with (store.js DEFAULT_STATE).
Json defaultState() => {
  'rev': 0,
  'verse': {
    'label': 'Focus Verse',
    'showLabel': true,
    'text': 'Thy word is a lamp unto my feet, and a light unto my path.',
    'ref': 'Psalm 119:105',
    'version': 'KJV',
    'visible': false,
    'seq': 0,
    'cut': 0,
    'itemId': 's1',
    'transition': 'rise',
    'speed': 'normal',
    'random': false,
    'pool': [...defaultPool],
    'burst': 'gentle',
    'play': '',
    'upcoming': '',
  },
  'question': {
    'label': 'Discussion Question',
    'showLabel': true,
    'text': 'What does this passage reveal about the character of God?',
    'visible': false,
    'seq': 0,
    'cut': 0,
    'itemId': 'q1',
    'mode': '',
    'transition': 'fade',
    'speed': 'normal',
    'random': false,
    'pool': [...defaultPool],
    'burst': 'gentle',
    'play': '',
    'upcoming': '',
  },
  'birthday': {
    'label': 'Birthday Celebration',
    'showLabel': true,
    'name': '',
    'greeting': '',
    'message': '',
    'country': '',
    'visible': false,
    'seq': 0,
    'cut': 0,
    'transition': 'rise',
  },
  'layout': {
    'bdayPos': 'top',
    'bdayScale': 1,
    'verseAlign': 'center',
    'verseY': 40,
    'verseWidth': 70,
    'verseScale': 1,
    'qBottom': 10,
    'qWidth': 84,
    'qScale': 1,
    'panel': 92,
  },
  'scenes': <dynamic>[],
  'live': {
    'scene': '',
    'seq': 0,
    'at': 0,
    'tx': 'cut',
    'txMs': 0,
    'auto': true,
    'blackout': false,
    'emergency': false,
    'freeze': false,
    'ink': {'on': false, 'items': <dynamic>[]},
    'message': 'Please stand by — we’ll be right back.',
    'on': <String, dynamic>{},
    'cd': <String, dynamic>{},
  },
  'profile': 'bible-study',
  'v6': false,
  'brand': {'meeting': '', 'org': '', 'color': '', 'logo': '', 'lw': 0, 'lh': 0, 'auto': false},
  'meeting': {
    'title': '',
    'date': '',
    'time': '',
    'location': '',
    'presenter': '',
    'contact': '',
    'attendees': '',
    'attendeeNotes': '',
    'owner': '',
    'contentNotes': '',
    'notes': '',
    'extra': '',
  },
  'library': {
    'verses': [
      {'id': 's1', 'ref': 'Psalm 119:105', 'version': 'KJV', 'text': 'Thy word is a lamp unto my feet, and a light unto my path.'},
      {
        'id': 's2',
        'ref': 'Isaiah 40:8',
        'version': 'KJV',
        'text': 'The grass withereth, the flower fadeth: but the word of our God shall stand for ever.',
      },
      {
        'id': 's3',
        'ref': 'Romans 8:38-39',
        'version': 'KJV',
        'text': 'For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come,\nnor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord.',
      },
    ],
    'questions': [
      {'id': 'q1', 'text': 'What does this passage reveal about the character of God?'},
      {'id': 'q2', 'text': 'Which phrase in today’s focus verse stood out to you most this week, and why?'},
      {
        'id': 'q3',
        'text': 'Think of a situation you are facing right now. How could the truth of this passage change the way you respond to it, and what is one practical step you could take before we meet again next week?',
      },
    ],
  },
};

// ---------- small helpers (the same as store.js) ----------
final _rng = Random();

/// A new id like the Windows app's ("L" + 7 random characters).
String rid([String prefix = 'L']) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  return prefix + List.generate(7, (_) => chars[_rng.nextInt(chars.length)]).join();
}

bool isObj(Object? o) => o is Map;

/// String(v).slice(0, n)
String str(Object? v, [int n = 200]) {
  final s = v == null ? '' : (v is num ? _numText(v) : v.toString());
  return s.length > n ? s.substring(0, n) : s;
}

String _numText(num v) => v == v.roundToDouble() && v.abs() < 1e15 ? v.toInt().toString() : v.toString();

/// Number(v) clamped to [lo, hi], or d when it is not a number.
num numIn(Object? v, num lo, num hi, num d) {
  final n = v is num ? v : (v is String ? num.tryParse(v.trim()) : (v is bool ? (v ? 1 : 0) : null));
  if (n == null || n.isNaN || n.isInfinite) return d;
  return n < lo ? lo : (n > hi ? hi : n);
}

/// Number(v) || 0
num numOr0(Object? v) {
  final n = v is num ? v : (v is String ? num.tryParse(v.trim()) : null);
  return n == null || n.isNaN ? 0 : n;
}

/// A deep copy of JSON data.
T deepCopy<T>(T v) {
  if (v is Map) return {for (final e in v.entries) e.key.toString(): deepCopy(e.value)} as T;
  if (v is List) return [for (final x in v) deepCopy(x)] as T;
  return v;
}
