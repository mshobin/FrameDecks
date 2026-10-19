# Frames

How to create, organize and reuse Frames, the building blocks of every meeting.

**Who this is for:** anyone who builds services or meetings in Kingdom Connect.

**On this page**
- [What a Frame is](#what-a-frame-is)
- [Create a Frame](#create-a-frame)
- [Name, group and order](#name-group-and-order)
- [Select several Frames](#select-several-frames)
- [Frame settings](#frame-settings)
- [Duplicate a Frame](#duplicate-a-frame)
- [One Frame per question](#one-frame-per-question)
- [Templates](#templates)
- [Frame files: share a Frame with another PC](#frame-files-share-a-frame-with-another-pc)
- [The Frame menu at a glance](#the-frame-menu-at-a-glance)
- [Best practices](#best-practices)

---

## What a Frame is

A **Frame** is one screen or one step of your meeting, such as *Welcome*, *Worship*, *Scripture Reading*,
*Discussion* or *Closing*. It holds the **Content** shown at that moment, and its own transition, timing and Teleprompter script.

```mermaid
flowchart TD
  M["Meeting: Romans · Week 5"] --> F1["Frame: Welcome"]
  M --> F2["Frame: Scripture Reading"]
  M --> F3["Frame: Discussion"]
  F3 --> C1["Content: Question (list of 3)"]
  F3 --> C2["Content: Scripture (list of 2)"]
  F3 --> C3["Content: Timer"]
```

**Every Frame owns its Content.** Two Frames never share a question, a scripture or a setting, so changing one Frame
never changes another.

## Create a Frame

| Way | How | Result |
| --- | --- | --- |
| **+ Frame** | Select **+ Frame** above the Frames list | One blank Frame, after the selected Frame |
| **Quick Start** | **✨ Meeting → Quick Start…** | A complete set of Frames for a Sunday Service, Bible Study, Youth Service, Conference and more |
| **Library** | The **Library** filter in the Frames list | Ready-made Frames you can add |
| **From a template** | **✨ Meeting → From your templates** | A new Frame made from one of your templates |
| **From Excel** | **✨ Meeting → Import meeting from Excel…** | Every Frame in the workbook. See [Service planning](service-planning.md#plan-in-excel-with-the-meeting-workbook) |
| **From a file** | **✨ Meeting → Import a Frame file…** | A Frame exported from another PC |

After creating a Frame, add Content with **+ Content**. See [Content](content.md).

## Name, group and order

- **Rename:** double-click the Frame's **name**, press **F2**, or type in Content Settings → **Frame → Name**. The
  name becomes a text box right in the list: **Enter** saves, **Esc** cancels, and clicking away saves. Double-clicking
  anywhere else on the Frame's row puts it on screen (**Go Live**).
- **Group:** Content Settings → **Frame → Group**, or **⋯ → Move to group…**. Groups fold away in the list; use one
  group per service, such as *Sunday 12 May* or *Romans · Week 5*.
- **Order:** drag a Frame up or down, or use **⋯ → Move up / Move down**. The order is the order of
  **Frame ▶**.
- **Favourite:** select the star on a Frame. The **Favorites** filter shows only starred Frames.
- **Recent:** the **Recent** filter shows what you worked on last.
- **Search:** type in **Search Frames** above the list, or press **Ctrl+K** to open the command palette and find any
  Frame, question or scripture. See [Presentations](presentations.md#command-palette).

## Select several Frames

You can work on several Frames at once.

| To | Do this |
| --- | --- |
| Add a Frame to the selection | **Ctrl+Click** it |
| Select a run of Frames | Click the first, then **Shift+Click** the last |
| Select with the mouse | Drag a box from empty space in the list |
| Select every Frame | **Ctrl+A** |
| Delete the selected Frames | **Delete** or **Backspace**. The message offers **Undo**. You are asked to confirm only for 5 or more |
| Copy, cut, paste | **Ctrl+C**, **Ctrl+X**, **Ctrl+V** |
| Duplicate | **Ctrl+D** |
| Move them | Drag them up or down |

Right-click the selection for the same actions in a menu.

## Frame settings

Select a Frame (and no Content) to see its settings in **Content Settings**.

### Frame
| Setting | What it does |
| --- | --- |
| **Name** | Shown in the Frames list, on the phone remote and in the Teleprompter |
| **Group** | Which group the Frame belongs to |
| **Favourite** | Shows the Frame under **Favorites** |
| **Template** | Keeps the Frame as a template for making new Frames. Templates are skipped by **Frame ▶** |
| **Teleprompter script** | What you plan to say on this Frame, up to 20,000 characters. Only you see it, in the Teleprompter (on the PC and the phone), never on screen. Called *Leader notes* before 6.7. See [Presentations](presentations.md#teleprompter) |
| **Branding** | Adds or removes your logo and Meeting Name badge in this Frame |

Buttons below: **Duplicate…**, **Save as template** and, when the Frame has questions, **One Frame per question**.

### Timing
| Setting | What it does |
| --- | --- |
| **Transition into this Frame** | How the Frame appears: your profile's transition, or a specific one such as Cut, Fade, Cross Dissolve, Dip to Black, Slide Left / Right, Push, Zoom Fade, Soft Scale, Cinema Fade or Church Service Fade |
| **Duration (ms)** | How long the transition takes |
| **Auto advance to the next Frame** | Moves on by itself after **After (seconds)**, but only while **Auto** is on in the command bar |

### History
**Created**, **Modified**, **Version**, **Creator**, **Duplicated from**, **Template** and **Parent Frame**. Every
change raises the Frame's version, so you can see what changed and when.

## Duplicate a Frame

Open the Frame's **⋯** menu, or select it and press **Ctrl+D**.

| Option | What you get |
| --- | --- |
| **Duplicate** (or **Duplicate & edit question** when the Frame has questions) | An exact copy; with questions, the copy's question opens for editing |
| **Duplicate (keep the question)** | An exact copy, without opening the editor |
| **Duplicate with options…** | Choose what to copy: Content; layout (positions and sizes); branding; animations; transitions and auto advance; output routing |
| **Duplicate as template** | A copy saved as a template |
| **Duplicate Content structure only** | The same Content, but with empty question and scripture lists |
| **Create variant** | A copy linked to the original as its **Parent Frame**, for example a shorter version |
| **Duplicate to group…** | A copy placed straight into another group, such as next week's service |

> **Note:** A duplicate is completely independent. Every Content and every question and scripture gets new IDs,
> and nothing is linked back to the original.

## One Frame per question

Some leaders prefer each question on its own Frame, so **Frame ▶** moves to the next question.

1. Select a Frame with a Question list.
2. Choose **⋯ → Make one Frame per question** (or **One Frame per question** in Frame settings).
3. New Frames, each with one question, appear right after it.

**Make one Frame per verse** does the same for a Scripture list.

## Templates

A **template** is a Frame you keep for making new Frames, such as your standard *Welcome* or *Closing*.

- **Make one:** **Save as template** in Frame settings, or **⋯ → Duplicate as template**.
- **Use one:** **✨ Meeting → From your templates →** the template's name.
- Templates stay in the Frames list but are not part of the running order: **Frame ▶** skips them and you cannot
  **Go Live** on a template.

## Frame files: share a Frame with another PC

- **Export:** **⋯ → Export Frame file** saves the Frame to your Downloads folder.
- **Import:** **✨ Meeting → Import a Frame file…** on the other PC.

To share a whole meeting, export it to Excel instead: **✨ Meeting → Export this meeting to Excel**.

## The Frame menu at a glance

| Item | Shortcut |
| --- | --- |
| Go Live | T |
| Duplicate / Duplicate & edit question | Ctrl+D |
| Duplicate (keep the question), with options, as template, structure only, Create variant, to group | — |
| Make one Frame per question / per verse | — |
| Rename | F2 |
| Move to group, Move up, Move down | — |
| Export Frame file | — |
| Delete Frame | — |

## Best practices

- **Name Frames for the volunteer**, not for yourself: *Scripture: Romans 8*, not *Frame 4*.
- **One group per service.** It keeps Frame ▶ in the right order and makes the next service easy to copy.
- **Keep a few templates** for parts that never change, such as Welcome, Offering and Closing.
- **Put private reminders in the Teleprompter script**, not in on-screen text.
- **Preview every Frame** before the service by selecting it. The canvas shows PREVIEW until you Go Live.

## Related
- [Content](content.md)
- [Service planning](service-planning.md)
- [Presentations](presentations.md)
- [Getting started](getting-started.md)
