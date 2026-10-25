"""FRAMEDECKS - migrating data from earlier product names.

Earlier installs used both Kingdom Connect and BSF Command Center. Their data folders and recordings are moved to the
FRAMEDECKS folders without overwriting newer files. Nothing here is ever shown to people.

(Other compatibility references remain in the browser-settings migration, installer cleanup, and firewall cleanup.)
"""
import json
import shutil
from pathlib import Path

NEW_NAME = "FRAMEDECKS"
OLD_NAME = "BSF Command Center"            # the original product name
PREVIOUS_NAMES = ("Kingdom Connect", OLD_NAME)
OLD_PREFIX, NEW_PREFIX = "bsf-", "kc-"     # data file names: bsf-saved-content.json -> kc-saved-content.json
OLD_FIREWALL_RULE = OLD_NAME + " iPad Remote"
OLD_GROUP_DEFAULT = "BSF"                  # the old default "Group Name" (Members > Settings), shown in meeting titles


def new_file_name(name):
    """bsf-studio.json -> kc-studio.json; other names unchanged."""
    return NEW_PREFIX + name[len(OLD_PREFIX):] if name.startswith(OLD_PREFIX) else name


def old_file_name(name):
    """kc-studio.json -> bsf-studio.json (to find a file in an older folder or backup)."""
    return OLD_PREFIX + name[len(NEW_PREFIX):] if name.startswith(NEW_PREFIX) else name


def find(folder, name):
    """The file `name` in `folder`, under its current name or earlier file prefix (None if neither)."""
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
    """Move folders from previous product names into the FRAMEDECKS folder without overwriting existing files."""
    parent = Path(parent)
    new = parent / NEW_NAME
    moved = False
    for previous_name in PREVIOUS_NAMES:
        old = parent / previous_name
        if not old.is_dir():
            continue
        try:
            if not new.exists():
                old.rename(new)
            else:
                _move_children(old, new)
                try:
                    old.rmdir()
                except OSError:
                    pass
            print(f"Moved earlier data from {old} to {new}")
            moved = True
        except OSError as e:
            print(f"Could not move earlier data from {old}:", e)
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
    """Move recordings from a previous product folder into Videos/FRAMEDECKS."""
    return migrate_folder(videos_dir) if Path(videos_dir).is_dir() else False
