"""
BSF Command Center - Windows desktop app.

Runs the same local program as server.py, shows the dashboard in its own window, and keeps an icon
near the clock (the "tray") so the overlays keep working in OBS/Camo when the window is closed.

Only one copy runs at a time: opening the app again brings the existing window to the front.
"""
import json
import os
import sys
import threading
import time
import traceback
import urllib.request
import webbrowser

APP_NAME = "BSF Command Center"


# ---------- A windowed app has no console: send messages to a small log file instead ----------
def _setup_log():
    base = os.environ.get("BSF_DATA_DIR") or os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), APP_NAME)
    try:
        os.makedirs(base, exist_ok=True)
        path = os.path.join(base, "bsf-app-log.txt")
        if os.path.exists(path) and os.path.getsize(path) > 1_000_000:
            os.replace(path, path + ".old")
        log = open(path, "a", encoding="utf-8", buffering=1)
        log.write(f"\n==== {time.strftime('%Y-%m-%d %H:%M:%S')} starting ====\n")
        if sys.stdout is None or getattr(sys, "frozen", False):
            sys.stdout = log
        if sys.stderr is None or getattr(sys, "frozen", False):
            sys.stderr = log
    except OSError:
        pass


_setup_log()
import server  # noqa: E402  (after logging is set up, because it prints)


def message(text, title=APP_NAME, warn=False):
    """A plain Windows message box (falls back to the log elsewhere)."""
    print(text)
    if os.name == "nt":
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, text, title, 0x30 if warn else 0x40)
        except Exception:
            pass


def ask(port, action):
    req = urllib.request.Request(f"http://127.0.0.1:{port}/api/app/{action}", data=b"{}",
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=3) as r:
        return r.status


def running_copy(port=server.PREFERRED_PORT):
    """What is already running on this port? None, "app" (this installed app) or "start-files" (the black-window version)."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/app/ping", timeout=1.5) as r:
            d = json.loads(r.read().decode())
    except Exception:
        return None
    if d.get("app") != APP_NAME:
        return None
    return "app" if d.get("installedApp") else "start-files"


START_FILES_RUNNING = ("The start-file version of BSF Command Center is still running (the black window).\n\n"
                       "Close that black window first, then open BSF Command Center again.\n\n"
                       "Only one copy can run at a time, and only the installed app has BCC vCam.")


def tray_do(action):
    try:
        server.studio_action(action)
    except Exception as e:
        print("Tray action failed:", e)


def tray_look(look_id):
    cur = server.vcam_settings()
    cur["look"] = look_id
    server.VCAM_SETTINGS_FILE.write_text(json.dumps(cur, indent=2), encoding="utf-8")
    eng = server.VCAM.get("engine")
    if eng:
        eng.configure(grade=server.vcam_grade(look_id))


def tray_hide_all():
    """Same as the red Hide all button: question, verse and birthday cards fade out everywhere."""
    def change(st):
        for k in ("question", "verse", "birthday"):
            if isinstance(st.get(k), dict):
                st[k]["visible"] = False
        return st
    server.update_state(change)


def tray_image():
    from PIL import Image
    return Image.open(server.APP / "icons" / "remote-192.png")


def main():
    # 1. Only one copy: if it is already running, bring its window forward and stop here.
    other = running_copy()
    if other == "start-files":
        message(START_FILES_RUNNING, warn=True)
        return
    if other == "app":
        try:
            ask(server.PREFERRED_PORT, "show")
        except Exception:
            pass
        return

    srv = server.start_main_server()
    if srv is None:
        message("BSF Command Center could not start because ports 8750-8760 are all in use.\n\n"
                "Close the other program using them, then open BSF Command Center again.", warn=True)
        return
    port = srv.server_address[1]
    if port != server.PREFERRED_PORT:
        if running_copy() == "app":             # started twice at the same moment
            srv.server_close()
            try:
                ask(server.PREFERRED_PORT, "show")
            except Exception:
                pass
            return
        message(f"Another program is using port {server.PREFERRED_PORT}, so BSF Command Center is using port {port} today.\n\n"
                "Your overlay links in OBS or Camo need the new port, or close the other program and restart.", warn=True)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    if server.app_settings()["remoteAutostart"]:
        server.set_remote(True)
    url = f"http://127.0.0.1:{port}/"

    state = {"quitting": False, "tray": None, "window": None, "hinted": False}

    # 2. Icon near the clock
    def build_tray(on_open, on_quit):
        try:
            import pystray
        except Exception:
            print("Tray icon not available:\n" + traceback.format_exc())
            return None
        def look_items():
            def pick(lid):
                return lambda icon, item: tray_look(lid)
            cur = server.vcam_settings().get("look", "off")
            looks = [("off", "Off")] + [(l["id"], l["name"]) for l in server._looks_list()]
            return [pystray.MenuItem(name, pick(lid), checked=(lambda item, lid=lid: server.vcam_settings().get("look") == lid), radio=True)
                    for lid, name in looks]

        def scene_items():
            def pick(sid):
                return lambda icon, item: tray_do({"op": "scene-apply", "id": sid})
            st = server.studio_load()
            if not st["scenes"]:
                return [pystray.MenuItem("No scenes saved yet", None, enabled=False)]
            return [pystray.MenuItem(x["name"], pick(x["id"]), checked=(lambda item, sid=x["id"]: server.studio_load()["activeScene"] == sid), radio=True)
                    for x in st["scenes"]]
        menu = pystray.Menu(
            pystray.MenuItem("Open BSF Command Center", lambda icon, item: on_open(), default=True),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Look", pystray.Menu(look_items)),
            pystray.MenuItem("Scene", pystray.Menu(scene_items)),
            pystray.MenuItem("Stop screen share", lambda icon, item: tray_do({"op": "screen", "source": None}),
                             enabled=lambda item: bool(server.VCAM.get("compositor") and server.VCAM["compositor"].screen)),
            pystray.MenuItem("Hide all overlays", lambda icon, item: tray_hide_all()),
            pystray.MenuItem("Presentation window", lambda icon, item: server.DESKTOP["present"](not server.DESKTOP["present_open"]()),
                             checked=lambda item: bool(server.DESKTOP.get("present_open") and server.DESKTOP["present_open"]())),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Phone remote", lambda icon, item: server.set_remote(not server.REMOTE),
                             checked=lambda item: server.REMOTE),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit BSF Command Center", lambda icon, item: on_quit()))
        icon = pystray.Icon("bsf-command-center", tray_image(), APP_NAME, menu)
        icon.run_detached()
        return icon

    def refresh_tray(_on=None):
        if state["tray"]:
            try:
                state["tray"].update_menu()
            except Exception:
                pass

    # 3. The app window (Windows' built-in Edge WebView2). Falls back to the normal browser if it's missing.
    try:
        import webview
    except Exception:
        webview = None
        print("App window not available:\n" + traceback.format_exc())

    def stop_everything():
        server.set_remote(False)
        eng = server.VCAM.get("engine")
        if eng:
            try:
                eng.stop()               # releases the webcam
            except Exception:
                pass
        if state["tray"]:
            try:
                state["tray"].stop()
            except Exception:
                pass
        try:
            srv.shutdown()
        except Exception:
            pass

    if webview is None:
        # Fallback: dashboard in the default browser, program keeps running from the tray icon
        done = threading.Event()

        def quit_fallback():
            done.set()
        state["tray"] = build_tray(lambda: webbrowser.open(url), quit_fallback)
        server.DESKTOP.update(active=False, show=lambda: webbrowser.open(url), quit=quit_fallback, on_remote_change=refresh_tray)
        webbrowser.open(url)
        if not state["tray"]:
            message("BSF Command Center is open in your web browser.\n\nIt keeps running in the background (so your overlays keep "
                    "working) until you restart or sign out of Windows.")
        done.wait()
        stop_everything()
        return

    webview.settings["ALLOW_DOWNLOADS"] = True                 # backups and Excel exports
    webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True  # WhatsApp etc. open in your browser
    window = webview.create_window(APP_NAME, url, width=1440, height=900, min_size=(1000, 640),
                                   background_color="#0a1222", text_select=True)
    state["window"] = window

    def show():
        try:
            window.show()
            window.restore()
        except Exception:
            pass

    def hide():
        window.hide()
        if not state["hinted"] and state["tray"]:
            state["hinted"] = True
            try:
                state["tray"].notify("Still running in the background, so your overlays keep working. "
                                     "Click the icon near the clock to open it again.", APP_NAME)
            except Exception:
                pass

    def quit_app():
        state["quitting"] = True
        stop_everything()
        try:
            window.destroy()
        except Exception:
            pass

    def choose_folder():
        kind = getattr(getattr(webview, "FileDialog", None), "FOLDER", None)
        if kind is None:
            kind = getattr(webview, "FOLDER_DIALOG", 20)
        result = window.create_file_dialog(kind)
        return result[0] if result else None

    def ask_page_about_closing():
        # The page shows "Keep running in the background / Quit / Cancel" (with a warning if anything is LIVE)
        try:
            handled = window.evaluate_js("window.BSFAppClosing ? BSFAppClosing() : false")
        except Exception:
            handled = False
        if not handled:
            hide()

    def on_closing():
        if state["quitting"]:
            return True
        threading.Thread(target=ask_page_about_closing, daemon=True).start()
        return False   # cancel the close; the page decides

    window.events.closing += on_closing

    def present(on=True):
        """The separate "BSF Presentation" window: its own Windows window, so Zoom can share just it."""
        w = state.get("present")
        if not on:
            state["present"] = None
            if w:
                try:
                    w.destroy()
                except Exception:
                    pass
            refresh_tray()
            return
        if w:
            try:
                w.restore()
                w.show()
                return
            except Exception:
                state["present"] = None
        w = webview.create_window("BSF Presentation", url + "present.html", width=1280, height=760,
                                  min_size=(480, 300), background_color="#000000", text_select=False)
        def closed():
            if state.get("present") is w:
                state["present"] = None
            refresh_tray()
        w.events.closed += closed
        state["present"] = w
        refresh_tray()
    state["tray"] = build_tray(show, quit_app)
    server.DESKTOP.update(active=True, show=show, hide=hide, quit=quit_app, choose_folder=choose_folder,
                          on_remote_change=refresh_tray, present=present,
                          present_open=lambda: state.get("present") is not None)
    webview.start(private_mode=False, storage_path=str(server.DATA / "webview"))
    stop_everything()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print(traceback.format_exc())
        message("BSF Command Center hit an unexpected problem and has to close.\n\n"
                "Details were saved in bsf-app-log.txt in your BSF Command Center data folder.", warn=True)
    finally:
        os._exit(0)
