"""FrameDecks - moving data saved under the program's earlier names.

FrameDecks was published under two earlier names. Installs from those times keep their data in a folder and in files
carrying those names, a Windows Firewall rule with them, and recordings in a folder named after them. This module is
the only Python code that knows the earlier names: it finds that data once and moves it to the FrameDecks names, so
nobody loses their meetings, members, settings or recordings. Nothing here is ever shown to people.

(The other places that must know the earlier names, for the same reason: the browser-settings block at the top of
app/js/store.js, the clean-up of the old program folders and shortcuts in packaging/installer.iss, and
tools/undo-ipad-remote.ps1, which removes the old firewall rules.)
"""
import json
import shutil
from pathlib import Path

NEW_NAME = "FrameDecks"
# the earlier product names, newest first (data folder, program folder, recordings folder)
OLD_NAMES = ("Kingdom Connect", "BSF Command Center")
OLD_NAME = OLD_NAMES[-1]                   # the first name, whose data files were called bsf-*
OLD_PREFIX, NEW_PREFIX = "bsf-", "kc-"     # data file names: bsf-saved-content.json -> kc-saved-content.json
OLD_FIREWALL_RULES = ("Kingdom Connect Phone Remote", "BSF Command Center iPad Remote")
OLD_GROUP_DEFAULT = "BSF"                  # the old default "Group Name" (Members > Settings), shown in meeting titles


def new_file_name(name):
    """bsf-studio.json -> kc-studio.json; other names unchanged."""
    return NEW_PREFIX + name[len(OLD_PREFIX):] if name.startswith(OLD_PREFIX) else name


def old_file_name(name):
    """kc-studio.json -> bsf-studio.json (to find a file in an older folder or backup)."""
    return OLD_PREFIX + name[len(NEW_PREFIX):] if name.startswith(NEW_PREFIX) else name


def find(folder, name):
    """The file `name` in `folder`, under its current name or its first name (None if neither)."""
    folder = Path(folder)
    for n in (name, old_file_name(name)):
        if (folder / n).is_file():
            return folder / n
    return None


def _move_children(src, dst):
    for item in src.iterdir():
        target = dst / (new_file_name(item.name) if item.is_file() else item.name)
        if target.exists():                     # never overwrite: the older copy stays where it was
            continue
        try:
            shutil.move(str(item), str(target))
        except OSError as e:
            print("Moving", item, "failed:", e)


def migrate_folder(parent):
    """parent/<an earlier name> -> parent/FrameDecks, the newest earlier name first. A rename when possible (instant,
    same disk); otherwise the contents are moved one by one, never overwriting anything already in the new folder.
    Returns True if anything moved."""
    parent = Path(parent)
    new = parent / NEW_NAME
    moved = False
    for name in OLD_NAMES:
        old = parent / name
        if not old.is_dir():
            continue
        try:
            if not new.exists():
                old.rename(new)
                print(f"Moved the data folder to {new}")
            else:
                _move_children(old, new)
                try:
                    old.rmdir()                     # only if it is now empty
                except OSError:
                    pass
                print(f"Moved earlier data into {new}")
            moved = True
        except OSError as e:
            print("Could not move the earlier data folder:", e)
    return moved


def migrate_files(folder):
    """Rename bsf-*.json / .txt data files in `folder` (and in its backups) to kc-*, never overwriting a newer kc-* file.
    Also clears the old default Group Name, so meeting titles do not start with it. Safe to run every start."""
    folder = Path(folder)
    moved = []
    try:
        names = [p.name for p in folder.iterdir() if p.is_file() and p.name.startswith(OLD_PREFIX)]
    except OSError:
        return moved
    for name in names:
        target = folder / new_file_name(name)
        if target.exists():
            continue
        try:
            (folder / name).rename(target)
            moved.append(target.name)
        except OSError as e:
            print("Renaming", name, "failed:", e)
    backups = folder / "backups"                        # each backup folder holds copies of the data files
    if backups.is_dir():
        for b in backups.iterdir():
            if b.is_dir():
                for f in b.iterdir():
                    if f.is_file() and f.name.startswith(OLD_PREFIX) and not (b / new_file_name(f.name)).exists():
                        try:
                            f.rename(b / new_file_name(f.name))
                        except OSError:
                            pass
    members = folder / (NEW_PREFIX + "members-private.json")
    if "kc-members-private.json" in moved and members.is_file():
        try:
            data = json.loads(members.read_text(encoding="utf-8"))
            st = data.get("settings") if isinstance(data, dict) else None
            if isinstance(st, dict) and st.get("groupName") == OLD_GROUP_DEFAULT:
                st["groupName"] = ""
                members.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        except (OSError, ValueError):
            pass
    if moved:
        print("Renamed data files:", ", ".join(moved))
    return moved


def migrate_app_data(appdata_dir):
    """Installed app: the whole data folder, then the files inside it."""
    appdata_dir = Path(appdata_dir)
    migrate_folder(appdata_dir)
    new = appdata_dir / NEW_NAME
    if new.is_dir():
        migrate_files(new)
    return new


def migrate_recordings(videos_dir):
    """Videos/<an earlier name> -> Videos/FrameDecks (recordings made before the rename)."""
    return migrate_folder(videos_dir) if Path(videos_dir).is_dir() else False
