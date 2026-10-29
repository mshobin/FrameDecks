/* FrameDecks - the Setup guide's steps (6.14). One list for the program and the website: hosted/src/lib/guide-steps.ts
 * holds the same ids, titles and places, and tests/guide-steps.test.js keeps the two equal.
 * where: 'both' = the step can be done (and detected) in the program and on the website; 'program' = only on the PC.
 * Each step is ticked only when the program sees it is true (guide.js), never by clicking it. */
(function(root){
'use strict';
var STEPS = [
  {id: 'welcome', title: 'Welcome', where: 'both', text: 'What kind of gathering do you lead? FrameDecks makes a ready set of Frames for it.'},
  {id: 'output', title: 'How people will see it', where: 'program', text: 'Zoom or Teams as a camera, a shared window, or a projector, TV or OBS.'},
  {id: 'phone', title: 'Your phone as a remote', where: 'program', text: 'Scan the code with your phone’s camera. It works on this Wi-Fi.'},
  {id: 'connect', title: 'Connect to FrameDecks', where: 'program', optional: true, text: 'Plan together on the website; your plans reach this PC by themselves.'},
  {id: 'frame', title: 'Make your first Frame', where: 'both', text: 'Add a Frame, or change one of the ready ones. A Frame is one moment on screen: a verse, a question, a picture or a welcome.'},
  {id: 'rehearse', title: 'Rehearse safely', where: 'program', text: 'Turn on Practice mode in Run and press Next. Your audience sees a black screen.'},
  {id: 'ready', title: 'Ready', where: 'program', text: 'Every line of Before you start is green.'}
];
var KINDS = [
  {id: 'bible-study', name: 'Bible Study'},
  {id: 'prayer', name: 'Prayer Meeting'},
  {id: 'youth', name: 'Youth Gathering'},
  {id: 'fellowship', name: 'Fellowship Meeting'},
  {id: 'other', name: 'Something else'}
];
var api = {steps: STEPS, kinds: KINDS};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.KCGuideSteps = api;
})(this);
