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

APP_NAME = "BSF Command Center"          # identity: data folder, single-instance check (never changes)
DISPLAY_NAME = "Kingdom Connect"     # what people see


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
from vcam.present_window import NativePresentation  # noqa: E402  (native Presentation window)


def message(text, title=DISPLAY_NAME, warn=False):
    """A plain Windows message box (falls back to the log elsewhere)."""
    print(text)
    if os.name == "nt":
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, text, title, 0x30 if warn else 0x40)
        except Exception:
            pass


# ---------- v6.4 native window: a title bar in the app's own colours, and an app-mode fallback ----------
TITLE_COLORS = {True: (0x1c1511, 0xf6f1ee), False: (0xfcfafa, 0x1e1c1c)}   # COLORREF (0x00BBGGRR): caption, text


def style_title_bar(hwnd, dark=True):
    """Windows 10/11: dark or light title bar (Minimize, Maximize/Restore and Close stay Windows' own).
    Windows 11 also takes the exact caption colour of the command bar, so the window reads as one surface."""
    if os.name != "nt" or not hwnd:
        return False
    try:
        import ctypes
        from ctypes import wintypes
        dwm = ctypes.windll.dwmapi
        set_attr = dwm.DwmSetWindowAttribute
        set_attr.argtypes = [wintypes.HWND, wintypes.DWORD, ctypes.c_void_p, wintypes.DWORD]
        on = ctypes.c_int(1 if dark else 0)
        for attr in (20, 19):                 # DWMWA_USE_IMMERSIVE_DARK_MODE (19 on early Windows 10 builds)
            if set_attr(hwnd, attr, ctypes.byref(on), ctypes.sizeof(on)) == 0:
                break
        cap, txt = TITLE_COLORS[bool(dark)]
        cap, txt = ctypes.c_uint(cap), ctypes.c_uint(txt)
        set_attr(hwnd, 35, ctypes.byref(cap), ctypes.sizeof(cap))   # DWMWA_CAPTION_COLOR (Windows 11)
        set_attr(hwnd, 36, ctypes.byref(txt), ctypes.sizeof(txt))   # DWMWA_TEXT_COLOR (Windows 11)
        # repaint the frame now
        ctypes.windll.user32.SetWindowPos(hwnd, None, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0004 | 0x0020)
        return True
    except Exception:
        return False


def window_handle(window):
    try:
        return int(window.native.Handle.ToInt64())
    except Exception:
        pass
    if os.name == "nt":
        try:
            import ctypes
            return ctypes.windll.user32.FindWindowW(None, DISPLAY_NAME) or 0
        except Exception:
            pass
    return 0


def app_browser():
    """Microsoft Edge (always on Windows 10/11) or Chrome, for a window without browser controls (--app mode)."""
    if os.name != "nt":
        return None
    roots = [os.environ.get(k) for k in ("ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA")]
    for rel in (r"Microsoft\Edge\Application\msedge.exe", r"Google\Chrome\Application\chrome.exe"):
        for root in roots:
            if root and os.path.isfile(os.path.join(root, rel)):
                return os.path.join(root, rel)
    return None


def open_app_window(url, profile):
    """Open the dashboard as an app window: no address bar, tabs or browser buttons. Returns True if it worked."""
    exe = app_browser()
    if not exe:
        return False
    try:
        import subprocess
        sep = "&" if "?" in url else "?"
        subprocess.Popen([exe, f"--app={url}{sep}shell=app", f"--user-data-dir={profile}", "--window-size=1440,900",
                          "--no-first-run", "--no-default-browser-check", "--disable-features=Translate"],
                         creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0), close_fds=True)
        return True
    except OSError:
        return False


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


START_FILES_RUNNING = ("The start-file version of Kingdom Connect is still running (the black window).\n\n"
                       "Close that black window first, then open Kingdom Connect again.\n\n"
                       "Only one copy can run at a time, and only the installed app has KingdomConnect.")


def tray_do(action):
    try:
        server.studio_action(action)
    except Exception as e:
        print("Tray action failed:", e)


def tray_look(look_id):
    cur = server.vcam_settings()
    cur["look"] = look_id
    server.vcam_save(cur)
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
        message("Kingdom Connect could not start because ports 8750-8760 are all in use.\n\n"
                "Close the other program using them, then open Kingdom Connect again.", warn=True)
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
        message(f"Another program is using port {server.PREFERRED_PORT}, so Kingdom Connect is using port {port} today.\n\n"
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
                return [pystray.MenuItem("No Frames saved yet", None, enabled=False)]
            return [pystray.MenuItem(x["name"], pick(x["id"]), checked=(lambda item, sid=x["id"]: server.studio_load()["activeScene"] == sid), radio=True)
                    for x in st["scenes"]]
        menu = pystray.Menu(
            pystray.MenuItem("Open Kingdom Connect", lambda icon, item: on_open(), default=True),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Look", pystray.Menu(look_items)),
            pystray.MenuItem("Frame", pystray.Menu(scene_items)),
            pystray.MenuItem("Stop screen share", lambda icon, item: tray_do({"op": "screen", "source": None}),
                             enabled=lambda item: bool(server.VCAM.get("compositor") and server.VCAM["compositor"].screen)),
            pystray.MenuItem("Hide all overlays", lambda icon, item: tray_hide_all()),
            pystray.MenuItem("Presentation window", lambda icon, item: server.DESKTOP["present"](not server.DESKTOP["present_open"]()),
                             checked=lambda item: bool(server.DESKTOP.get("present_open") and server.DESKTOP["present_open"]())),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Phone remote", lambda icon, item: server.set_remote(not server.REMOTE),
                             checked=lambda item: server.REMOTE),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit Kingdom Connect", lambda icon, item: on_quit()))
        icon = pystray.Icon("bsf-command-center", tray_image(), DISPLAY_NAME, menu)
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
        # Fallback without WebView2: an Edge (or Chrome) app window - its own window, without an address bar, tabs or
        # browser buttons - and only if neither exists, the default browser. The program keeps running from the tray.
        done = threading.Event()
        profile = str(server.DATA / "appwindow")

        def open_ui():
            if open_app_window(url, profile):
                server.DESKTOP["shell"] = "app-browser"
            else:
                server.DESKTOP["shell"] = "browser"
                webbrowser.open(url)

        def quit_fallback():
            done.set()
        state["tray"] = build_tray(open_ui, quit_fallback)
        server.DESKTOP.update(active=False, show=open_ui, quit=quit_fallback, on_remote_change=refresh_tray)
        open_ui()
        if not state["tray"]:
            where = "its own window" if server.DESKTOP.get("shell") == "app-browser" else "your web browser"
            message(f"Kingdom Connect is open in {where}.\n\nIt keeps running in the background (so your overlays keep "
                    "working) until you restart or sign out of Windows.")
        done.wait()
        stop_everything()
        return

    webview.settings["ALLOW_DOWNLOADS"] = True                 # backups and Excel exports
    webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True  # WhatsApp etc. open in your browser
    window = webview.create_window(DISPLAY_NAME, url, width=1440, height=900, min_size=(1000, 640),
                                   background_color="#0a1222", text_select=True)
    state["window"] = window
    server.DESKTOP["shell"] = "webview"
    state["dark"] = True

    def set_theme(dark):
        state["dark"] = bool(dark)
        return style_title_bar(window_handle(window), state["dark"])

    def on_shown():
        set_theme(state["dark"])
    try:
        window.events.shown += on_shown
    except Exception:
        pass

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
                                     "Click the icon near the clock to open it again.", DISPLAY_NAME)
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
        """The separate "BSF Presentation" window (Zoom > Share Screen > that window).
        Preferred: a native window (no browser engine, very light on the graphics card). Fallback: a WebView2 window."""
        w = state.get("present")
        if not on:
            state["present"] = None
            if w:
                try:
                    (w.close if isinstance(w, NativePresentation) else w.destroy)()
                except Exception:
                    pass
            refresh_tray()
            return
        if w:
            if isinstance(w, NativePresentation) and w.is_open():
                return
            if not isinstance(w, NativePresentation):
                try:
                    w.restore()
                    w.show()
                    return
                except Exception:
                    pass
            state["present"] = None
        comp, eng = server.VCAM.get("compositor"), server.VCAM.get("engine")
        if comp and eng and server.app_settings().get("nativePresent", True):
            try:
                state["present"] = NativePresentation(
                    comp, eng.keep_awake, lambda: server.vcam_settings().get("presentFps", 15), server.APP / "fonts",
                    on_closed=lambda: (state.update(present=None) if isinstance(state.get("present"), NativePresentation)
                                       and not state["present"].is_open() else None, refresh_tray()))
                print("Presentation window: native (no browser engine)")
                refresh_tray()
                return
            except Exception as e:
                print("Presentation window: native window unavailable, using WebView2 instead:", e)
        # Frameless: no title bar, no minimise/maximise/close buttons, no window frame. Drag anywhere to move it.
        # The title stays internal (never shown) so Zoom can list it under "Share specific window".
        w = webview.create_window("BSF Presentation", url + "present.html", width=1280, height=720,
                                  min_size=(480, 270), background_color="#000000", text_select=False,
                                  frameless=True, easy_drag=True)
        state["present_fs"] = False
        def closed():
            if state.get("present") is w:
                state["present"] = None
            refresh_tray()
        w.events.closed += closed
        state["present"] = w
        refresh_tray()

    def speaker():
        """v6.7 Teleprompter window: the Frame script, what comes next and a clock, in a window of its own (never shared)."""
        w = state.get("speaker")
        if w:
            try:
                w.restore()
                w.show()
                return
            except Exception:
                state["speaker"] = None
        w = webview.create_window(DISPLAY_NAME + " · Teleprompter", url + "speaker.html", width=1200, height=780,
                                  min_size=(640, 420), background_color="#0b0e13", text_select=True)
        def closed():
            if state.get("speaker") is w:
                state["speaker"] = None
        w.events.closed += closed
        state["speaker"] = w

    def present_fullscreen(want=None):
        """Full Screen in the Presentation window: the window itself fills the screen (no frame at all)."""
        w = state.get("present")
        if not w:
            return False
        if isinstance(w, NativePresentation):
            return w.set_fullscreen(want)
        cur = bool(state.get("present_fs"))
        if want is None or bool(want) != cur:
            try:
                w.toggle_fullscreen()
                state["present_fs"] = not cur
            except Exception:
                pass
        return bool(state.get("present_fs"))

    def present_open():
        w = state.get("present")
        return bool(w) and (w.is_open() if isinstance(w, NativePresentation) else True)

    def present_fs_state():
        w = state.get("present")
        if isinstance(w, NativePresentation):
            return w.is_open() and w.fullscreen
        return bool(w and state.get("present_fs"))
    state["tray"] = build_tray(show, quit_app)
    server.DESKTOP.update(active=True, show=show, hide=hide, quit=quit_app, choose_folder=choose_folder, window_theme=set_theme,
                          on_remote_change=refresh_tray, present=present, present_fullscreen=present_fullscreen,
                          present_fs_state=present_fs_state, present_open=present_open, speaker=speaker)
    # "Light on graphics card" (Settings > General, on by default): the app's windows are drawn without the GPU.
    # The dashboard is mostly still, so the CPU handles it easily, and the GPU stays free for Windows and Zoom.
    # (pywebview's own argument is kept; the variable takes precedence over arguments set in code.)
    if server.app_settings().get("lowGpu", True):
        os.environ["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] = (
            "--disable-features=ElasticOverscroll --disable-gpu --disable-gpu-compositing")
        server.DESKTOP["low_gpu"] = True
    webview.start(private_mode=False, storage_path=str(server.DATA / "webview"))
    stop_everything()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print(traceback.format_exc())
        message("Kingdom Connect hit an unexpected problem and has to close.\n\n"
                "Details were saved in bsf-app-log.txt in your data folder (%APPDATA%\\BSF Command Center).", warn=True)
    finally:
        os._exit(0)
