"""
FrameDecks - Windows desktop app.

Runs the same local program as src/server.py, shows the dashboard in its own window, and keeps an icon
near the clock (the "tray") so the overlays keep working in OBS/Camo when the window is closed.

Only one copy runs at a time: opening the app again brings the existing window to the front.
6.11: the website's "Open FrameDecks on this PC" starts it through a framedecks:// link (registered by the
installer). That is the same as opening it: the link is never read, so a web page cannot make it do anything else.
"""
from errlog import swallowed as _swallowed  # noqa: E402
import json
import os
import sys
import threading
import time
import traceback
import urllib.request
import webbrowser

if __name__ == "__main__" and "--firewall" in sys.argv:
    import winapi                  # 7.1.1: "Allow through Windows Firewall", started with administrator rights
    sys.exit(winapi.firewall_main(sys.argv))

if __name__ == "__main__":
    import supervisor              # the installed app first starts as a small watchdog (restarts it after a crash)
    if supervisor.wanted():
        sys.exit(supervisor.run())

APP_NAME = "FRAMEDECKS"          # identity: data folder name and the single-instance check
DISPLAY_NAME = "FrameDecks"     # what people see


# ---------- A windowed app has no console: send messages to a small log file instead ----------
def _setup_log():
    if not os.environ.get("KC_DATA_DIR"):
        try:                                   # 6.9: data saved under the earlier name moves first, before any file opens
            import legacy
            legacy.migrate_app_data(os.environ.get("APPDATA") or os.path.expanduser("~"))
        except Exception as _e:
            _swallowed("desktop_app._setup_log", _e)
    base = os.environ.get("KC_DATA_DIR") or os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), APP_NAME)
    try:
        os.makedirs(base, exist_ok=True)
        path = os.path.join(base, "kc-app-log.txt")
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
import desktop_win as dw  # noqa: E402  (6.8 ribbon instead of title bars, see-through overlay, global shortcuts)


def message(text, title=DISPLAY_NAME, warn=False):
    """A plain Windows message box (falls back to the log elsewhere)."""
    print(text)
    if os.name == "nt":
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, text, title, 0x30 if warn else 0x40)
        except Exception as _e:
            _swallowed("desktop_app.message", _e)


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
    except Exception as _e:
        _swallowed("desktop_app.window_handle", _e)
    if os.name == "nt":
        try:
            import ctypes
            return ctypes.windll.user32.FindWindowW(None, DISPLAY_NAME) or 0
        except Exception as _e:
            _swallowed("desktop_app.window_handle", _e)
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


def running_copy(port=server.PREFERRED_PORT, wait=1.5):
    """What is already running on this port? None, "app" (this installed app), "start-files" (the black-window
    version) or "stuck" (something takes the connection but never answers: a copy that did not finish closing).
    Connecting and answering are timed apart: on Windows a port with nothing on it takes about 2 s to refuse."""
    import http.client
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
    try:
        conn.connect()
    except OSError:                                      # refused (nothing there) or no reply to the connection
        return None
    try:
        conn.sock.settimeout(wait)
        conn.request("GET", "/api/app/ping")
        d = json.loads(conn.getresponse().read().decode())
    except TimeoutError:                                 # connected, but no answer
        return "stuck"
    except Exception:
        return None
    finally:
        conn.close()
    if d.get("app") != APP_NAME:
        return None
    return "app" if d.get("installedApp") else "start-files"


def end_stuck_copies():
    """6.10: end earlier copies of this program that stopped answering (6.8 and 6.9 could stay behind after Quit, still
    holding the port). Only processes with this program's own name, never this one."""
    if os.name != "nt" or not getattr(sys, "frozen", False):
        return False
    import winapi                                       # 7.1.1: through Windows itself, not taskkill
    try:
        print("Ended copies that had stopped answering:", winapi.end_other_copies(os.path.basename(sys.executable)))
    except Exception as e:
        print("Could not end the earlier copy:", e)
        return False
    time.sleep(1.0)                                     # Windows frees the port when the process is gone
    return True


START_FILES_RUNNING = ("The start-file version of FrameDecks is still running (the black window).\n\n"
                       "Close that black window first, then open FrameDecks again.\n\n"
                       "Only one copy can run at a time, and only the installed app has FrameDecks.")


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
        if isinstance(st.get("live"), dict):
            st["live"].pop("memory", None)             # 9.0 the chat overlay's Memory Cards too
        return st
    server.update_state(change)


def tray_image():
    from PIL import Image
    return Image.open(server.APP / "icons" / "tray-64.png")


def main():
    # 1. Only one copy: if it is already running, bring its window forward and stop here.
    other = running_copy()
    if other == "stuck":                       # a busy copy may just be slow: ask once more, with more patience
        other = running_copy(wait=6)
    if other == "start-files":
        message(START_FILES_RUNNING, warn=True)
        return
    if other == "app":
        try:
            ask(server.PREFERRED_PORT, "show")
        except Exception as _e:
            _swallowed("desktop_app.main", _e)
        return
    if other == "stuck":
        end_stuck_copies()

    srv = server.start_main_server()
    if srv is None:
        message("FrameDecks could not start because ports 8750-8760 are all in use.\n\n"
                "Close the other program using them, then open FrameDecks again.", warn=True)
        return
    port = srv.server_address[1]
    if port != server.PREFERRED_PORT:
        if running_copy() == "app":             # started twice at the same moment
            srv.server_close()
            try:
                ask(server.PREFERRED_PORT, "show")
            except Exception as _e:
                _swallowed("desktop_app.main", _e)
            return
        message(f"Another program is using port {server.PREFERRED_PORT}, so FrameDecks is using port {port} today.\n\n"
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
        more = pystray.Menu(
            pystray.MenuItem("Look", pystray.Menu(look_items)),
            pystray.MenuItem("Frame", pystray.Menu(scene_items)),
            pystray.MenuItem("Stop screen share", lambda icon, item: tray_do({"op": "screen", "source": None}),
                             enabled=lambda item: bool(server.VCAM.get("compositor") and server.VCAM["compositor"].screen)),
            pystray.MenuItem("Hide all overlays", lambda icon, item: tray_hide_all()),
            pystray.MenuItem("Presentation window", lambda icon, item: server.DESKTOP["present"](not server.DESKTOP["present_open"]()),
                             checked=lambda item: bool(server.DESKTOP.get("present_open") and server.DESKTOP["present_open"]())),
            pystray.MenuItem("Phone remote", lambda icon, item: server.set_remote(not server.REMOTE),
                             checked=lambda item: server.REMOTE))
        hook = lambda name, *a: (lambda icon, item: server.DESKTOP[name](*a) if server.DESKTOP.get(name) else on_open())
        menu = pystray.Menu(                       # 6.8: the five things people reach for, then everything else
            pystray.MenuItem("Open App", lambda icon, item: on_open(), default=True),
            pystray.MenuItem("Teleprompter", hook("teleprompter", "toggle"),
                             checked=lambda item: bool(server.DESKTOP.get("teleprompter_open") and server.DESKTOP["teleprompter_open"]())),
            pystray.MenuItem("Capture copies (Memory Cards)", lambda icon, item: server.memory_capture(not server.MEMORY.capture),
                             checked=lambda item: bool(server.MEMORY.capture)),
            pystray.MenuItem("Command Center", hook("spotlight", True)),
            pystray.MenuItem("Settings", hook("open_settings")),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("More", more),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Exit", lambda icon, item: on_quit()))
        icon = pystray.Icon("framedecks", tray_image(), DISPLAY_NAME, menu)
        icon.run_detached()
        return icon

    def refresh_tray(_on=None):
        if state["tray"]:
            try:
                state["tray"].update_menu()
            except Exception as _e:
                _swallowed("desktop_app.refresh_tray", _e)

    # 3. The app window (Windows' built-in Edge WebView2). Falls back to the normal browser if it's missing.
    try:
        import webview
    except Exception:
        webview = None
        print("App window not available:\n" + traceback.format_exc())

    def stop_everything():
        server.flush_state()             # a live change from the last second (quitting ends the process at once)
        server.set_remote(False)
        eng = server.VCAM.get("engine")
        if eng:
            try:
                eng.stop()               # releases the webcam
            except Exception as _e:
                _swallowed("desktop_app.stop_everything", _e)
        if state["tray"]:
            try:
                state["tray"].stop()
            except Exception as _e:
                _swallowed("desktop_app.stop_everything", _e)
        try:
            srv.shutdown()
            srv.server_close()           # 6.10: free the port at once, so the next start gets it
        except Exception as _e:
            _swallowed("desktop_app.stop_everything", _e)

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
            message(f"FrameDecks is open in {where}.\n\nIt keeps running in the background (so your overlays keep "
                    "working) until you restart or sign out of Windows.")
        done.wait()
        stop_everything()
        return

    webview.settings["ALLOW_DOWNLOADS"] = True                 # backups and Excel exports
    webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True  # WhatsApp etc. open in your browser
    # 9.7 the main window opens maximized: it fills the screen (the taskbar stays), after an install and every start
    window = webview.create_window(DISPLAY_NAME, url, width=1440, height=900, min_size=(1000, 640),
                                   background_color="#070c18", text_select=True, maximized=True)
    state["window"] = window
    server.DESKTOP["shell"] = "webview"
    state["dark"] = True

    def set_theme(dark):
        state["dark"] = bool(dark)
        return style_title_bar(window_handle(window), state["dark"])

    settings = server.app_settings()
    chromes = {}                          # window name -> dw.Chrome (the ribbon replaces the Windows title bar)

    def add_chrome(name, w):
        """6.8: no Windows title bar; the page's ribbon (app/js/window-chrome.js) moves the window and has the buttons."""
        if not settings.get("customChrome", True):
            return False
        c = dw.Chrome(window_handle(w))
        if c.ok:
            chromes[name] = c
        return c.ok

    def on_shown():
        set_theme(state["dark"])
        server.DESKTOP["chrome"] = add_chrome("main", window)
    try:
        window.events.shown += on_shown
    except Exception as _e:
        _swallowed("desktop_app.main", _e)

    def show():
        try:
            window.show()
            hwnd = window_handle(window)
            if not (dw.IS_WIN and hwnd) or dw.user32.IsIconic(hwnd):   # minimized: back as it was (maximized stays maximized)
                window.restore()
        except Exception as _e:
            _swallowed("desktop_app.show", _e)

    def hide():
        window.hide()
        if not state["hinted"] and state["tray"]:
            state["hinted"] = True
            try:
                state["tray"].notify("Still running in the background, so your overlays keep working. "
                                     "Click the icon near the clock to open it again.", DISPLAY_NAME)
            except Exception as _e:
                _swallowed("desktop_app.hide", _e)

    def quit_app():
        """Quit (the page's close dialog or the tray). 6.10: every window must close, the hidden Spotlight window
        too: while one is left, webview.start() does not return and the process stays behind. A safety net ends the
        process if a window will not close."""
        state["quitting"] = True
        stop_everything()
        server.install_on_exit()         # 7.0: "Update when I close FrameDecks" starts its install now
        threading.Timer(5.0, lambda: os._exit(0)).start()
        for close in (lambda: present(False), lambda: teleprompter(False),
                      lambda: spot_window() and spot_window().destroy(), lambda: window.destroy()):
            try:
                close()
            except Exception as _e:
                _swallowed("desktop_app.quit_app", _e)

    def choose_folder():
        kind = getattr(getattr(webview, "FileDialog", None), "FOLDER", None)
        if kind is None:
            kind = getattr(webview, "FOLDER_DIALOG", 20)
        result = window.create_file_dialog(kind)
        return result[0] if result else None

    def ask_page_about_closing():
        # The page shows "Keep running in the background / Quit / Cancel" (with a warning if anything is LIVE)
        try:
            handled = window.evaluate_js("window.KCAppClosing ? KCAppClosing() : false")
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
        """The separate "FrameDecks Share Window" window (Zoom > Share Screen > that window).
        Preferred: a native window (no browser engine, very light on the graphics card). Fallback: a WebView2 window."""
        w = state.get("present")
        if not on:
            state["present"] = None
            if w:
                try:
                    (w.close if isinstance(w, NativePresentation) else w.destroy)()
                except Exception as _e:
                    _swallowed("desktop_app.present", _e)
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
                except Exception as _e:
                    _swallowed("desktop_app.present", _e)
            state["present"] = None
        comp, eng = server.VCAM.get("compositor"), server.VCAM.get("engine")
        if comp and eng and server.app_settings().get("nativePresent", True):
            try:
                state["present"] = NativePresentation(
                    comp, eng.keep_awake, lambda: server.vcam_settings().get("presentFps", 15), server.APP / "fonts",
                    on_closed=lambda: (state.update(present=None) if isinstance(state.get("present"), NativePresentation)
                                       and not state["present"].is_open() else None, refresh_tray()),
                    annotator=share_annotator)
                print("Presentation window: native (no browser engine)")
                refresh_tray()
                return
            except Exception as e:
                print("Presentation window: native window unavailable, using WebView2 instead:", e)
        # Frameless: no title bar, no minimise/maximise/close buttons, no window frame. Drag anywhere to move it.
        # The title stays internal (never shown) so Zoom can list it under "Share specific window".
        w = webview.create_window("FrameDecks Share Window", url + "present.html", width=1280, height=720,
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

    # 8.1 the Teleprompter's transparency: with the graphics card the page paints its own see-through background and
    # the text stays solid (glass); with "Light on graphics card" (low_gpu) the whole window fades instead.
    PROMPTER_FADE = {"solid": 1.0, "presenter": 0.85, "meeting": 0.65, "conference": 0.4, "ghost": 0.2}

    def prompter_glass():
        return not server.DESKTOP.get("low_gpu")

    def prompter_look(w, look):
        hwnd = window_handle(w)
        if prompter_glass():
            dw.glass(hwnd, False)
        else:
            dw.fade(hwnd, PROMPTER_FADE.get(look, 1.0))

    def teleprompter(on="toggle"):
        """8.0 the Teleprompter: one window (speaker.html), above Zoom and Teams, kept out of screen sharing.
        8.1: pin (stay on top) and five transparency levels, both remembered."""
        w = state.get("teleprompter")
        if on == "toggle":
            on = not w
        if not on:
            state["teleprompter"] = None
            if w:
                try:
                    w.destroy()
                except Exception as _e:
                    _swallowed("desktop_app.teleprompter", _e)
            refresh_tray()
            return False
        if w:
            try:
                w.restore()
                w.show()
                dw.bring_to_front(window_handle(w))
                return True
            except Exception:
                state["teleprompter"] = None
        cfg = server.app_settings()
        w = webview.create_window(DISPLAY_NAME + " · Teleprompter", url + "speaker.html", width=1000, height=640,
                                  min_size=(420, 260), background_color="#000000" if prompter_glass() else "#070c18",
                                  text_select=True, transparent=prompter_glass(), on_top=bool(cfg.get("prompterOnTop", True)))
        def shown():
            if not add_chrome("teleprompter", w):
                c = dw.Chrome(window_handle(w))
                if c.ok:
                    chromes["teleprompter"] = c                     # keep it: its window procedure lives in it
            prompter_look(w, server.app_settings().get("prompterLook", "solid"))
            dw.hide_from_capture(window_handle(w))     # only the leader sees it, even when sharing the whole screen
        def closed():
            if state.get("teleprompter") is w:
                state["teleprompter"] = None
            chromes.pop("teleprompter", None)
            refresh_tray()
        w.events.shown += shown
        w.events.closed += closed
        state["teleprompter"] = w
        state.get("on_top", {}).pop("teleprompter", None)
        refresh_tray()
        return True

    # ---------- 9.0 the Memory Card popup: a small card in the screen corner when something is copied ----------
    # Replaces 8.8's Audience Dock. Kept deliberately simple, because the dock's handle drag crashed
    # (Illegal Instruction 0xC000001D): one window, made once and then only shown and hidden; never dragged, never
    # click-through, never faded (no WS_EX_LAYERED / WS_EX_TRANSPARENT changes on a WebView2 window), no thread polling
    # it. It never takes the keyboard (pywebview focus=False = WS_EX_NOACTIVATE) and is left out of screen sharing.
    # Placed in screen pixels by Windows (pywebview scales x / y / size by the display scale: see 8.8.1).
    POP = {"win": None, "open": False, "h": 236}
    POP_W, POP_MARGIN = 360, 16

    def popup_hwnd():
        w = POP["win"]
        try:
            return int(w.native.Handle.ToInt64()) if w is not None else 0
        except Exception:
            return 0

    def popup_rect(scale):
        wa = dw.work_area() or [0, 0, 1920, 1040]
        w, h, m = int(POP_W * scale), int(POP["h"] * scale), int(POP_MARGIN * scale)
        return [wa[0] + wa[2] - w - m, wa[1] + wa[3] - h - m, w, h]

    def popup_place():
        hwnd = popup_hwnd()
        if hwnd:
            dw.place(hwnd, *popup_rect(dw.display_scale(hwnd)))

    def popup_show(on=True):
        """A new Memory Card: show the popup (made the first time), without taking the keyboard from Zoom or Teams."""
        if not on:
            return popup_op("hide", {})
        if POP["win"] is None:
            scale = dw.display_scale()
            lr = [int(round(v / scale)) for v in popup_rect(scale)]
            w = webview.create_window(DISPLAY_NAME + " · Memory Card", url + "memory-popup.html", x=lr[0], y=lr[1], width=lr[2],
                                      height=lr[3], background_color="#0b1222", frameless=True, easy_drag=False, on_top=True,
                                      focus=False, text_select=False)
            POP["win"] = w

            def shown():
                hwnd = popup_hwnd()
                dw.hide_from_capture(hwnd)         # only the presenter sees it, even sharing the whole screen
                dw.round_corners(hwnd)
                popup_place()

            def closed():
                POP.update(win=None, open=False)
            w.events.shown += shown
            w.events.closed += closed
        else:
            popup_place()
            dw.show_no_activate(popup_hwnd())
            dw.set_topmost(popup_hwnd(), True)
        POP["open"] = True
        server.MEMORY.touch()
        return True

    def popup_op(op, data):
        """The popup page: hide (nothing left to show), size (its height in pixels, to fit its cards)."""
        hwnd = popup_hwnd()
        if op == "hide" and hwnd:
            dw.show_async(hwnd, dw.SW_HIDE)
            POP["open"] = False
        elif op == "size":
            try:
                POP["h"] = max(96, min(560, int(data.get("h") or 236)))
            except (TypeError, ValueError):
                pass
            popup_place()
        return popup_state()

    def popup_state():
        return {"desktop": True, "open": bool(POP["open"] and POP["win"] is not None)}

    # ---------- 6.8 Spotlight: one small window, shown and hidden ----------
    # 9.8.1: made the first time it is asked for (the shortcut or the tray's Search), never at start. pywebview shows a
    # see-through window by itself whenever its page starts loading (edgechromium on_navigation_start: Show + Activate,
    # whatever "hidden" says), so a Spotlight made at start-up popped up over the welcome after an install.
    SPOT_H = 720                                  # 9.10.2 the Command Center's fixed height (see spot_window)
    spot_holder = {"w": None}
    spot_lock = threading.Lock()
    state["spot_ready"] = False

    def spot_settle():
        """Whenever the page has (re)loaded or the window showed itself: hidden unless the shortcut opened it."""
        w = spot_holder["w"]
        if w is not None and not state.get("spot_open"):
            try:
                w.hide()
            except Exception as _e:
                _swallowed("desktop_app.spot_settle", _e)

    def spot_window(create=False):
        with spot_lock:
            if spot_holder["w"] is None and create:
                # 9.10.2 one fixed size: the window is see-through, so its empty part costs nothing, and the
                # Command Center never resizes a window while its panels animate (that made chip changes stutter)
                w = webview.create_window(DISPLAY_NAME + " · Command Center", url + "spotlight.html", width=820, height=SPOT_H,
                                          background_color="#0f172b", frameless=True, easy_drag=False, hidden=True,
                                          on_top=True, text_select=False, transparent=True)
                try:                                  # 9.10.2 black (see-through) before Windows first shows it
                    w.events.before_show += lambda *_a: dw.clear_back(getattr(w, "native", None))
                except Exception as _e:
                    _swallowed("desktop_app.spot_window", _e)
                for ev in (w.events.loaded, w.events.shown):
                    try:
                        ev += spot_settle
                    except Exception as _e:
                        _swallowed("desktop_app.spot_window", _e)
                spot_holder["w"] = w
                try:
                    w.events.loaded.wait(8)          # the page is ready before it is shown the first time
                except Exception as _e:
                    _swallowed("desktop_app.spot_window", _e)
                spot_prepare(w)                       # see-through, no frame: all done before the first open
            return spot_holder["w"]

    def spot_prepare(w):
        if state["spot_ready"]:
            return
        hwnd = window_handle(w)
        dw.clear_frame(hwnd)                                   # 9.10 no frame, no corners, no border line
        dw.clear_back(getattr(w, "native", None), wait=True)   # 9.10.1 no grey box behind the glass
        state["spot_glass"] = bool(dw.glass(hwnd, False))      # see-through: only the glass bar and its chips show
        state["spot_ready"] = True
        try:                                                   # the page's own background goes see-through before it shows
            w.evaluate_js("window.KCSpotlight && KCSpotlight.glass && KCSpotlight.glass(%s)"
                          % ("true" if state.get("spot_glass") else "false"))
        except Exception as _e:
            _swallowed("desktop_app.spot_prepare", _e)

    def spotlight(on=True):
        if on == "toggle":
            on = not state.get("spot_open")
        if not on:
            state["spot_open"] = False
            spot = spot_window()
            if spot is not None:
                try:
                    spot.hide()
                except Exception as _e:
                    _swallowed("desktop_app.spotlight", _e)
            return
        spot = spot_window(create=True)
        hwnd = window_handle(spot)
        spot_prepare(spot)
        dw.hide_from_capture(hwnd)        # 9.6 every time: like the Teleprompter, only the presenter sees it, even sharing the screen
        cfg = server.app_settings()
        place = cfg.get("ccPlace", "top")
        dw.center_on_cursor(hwnd, where=place)
        try:                              # 9.12 its size and place are drawn before it shows (no jump on opening)
            spot.evaluate_js("window.KCSpotlight && KCSpotlight.look && KCSpotlight.look(%s)"
                             % json.dumps({"size": cfg.get("ccSize", "regular"), "place": place}))
        except Exception as _e:
            _swallowed("desktop_app.spotlight", _e)
        state["spot_open"] = True
        try:
            spot.show()
        except Exception as _e:
            _swallowed("desktop_app.spotlight", _e)
        dw.bring_to_front(hwnd)
        try:
            spot.evaluate_js("window.KCSpotlight && (KCSpotlight.glass && KCSpotlight.glass(%s), KCSpotlight.opened())"
                             % ("true" if state.get("spot_glass") else "false"))
        except Exception as _e:
            _swallowed("desktop_app.spotlight", _e)

    def palette_index():
        try:
            raw = window.evaluate_js("JSON.stringify(window.KCPalette && KCPalette.exportIndex ? KCPalette.exportIndex() : [])")
            return json.loads(raw or "[]")
        except Exception as e:
            print("Spotlight index:", e)
            return []

    def palette_run(key, background):
        spotlight(False)
        if not background:
            show()
        try:
            window.evaluate_js("window.KCPalette && KCPalette.runKey(%s)" % json.dumps(key))
        except Exception as e:
            print("Spotlight action:", e)

    def open_settings():
        show()
        try:
            window.evaluate_js("window.KCSetTab && KCSetTab('settings')")
        except Exception as _e:
            _swallowed("desktop_app.open_settings", _e)

    # ---------- 6.8 the page's window buttons and ribbon ----------
    def win(name, op, data):
        w = {"main": window, "teleprompter": state.get("teleprompter"), "spotlight": spot_window()}.get(name)
        if w is None:
            return {"ok": False}
        hwnd = window_handle(w)
        maximized = lambda: bool(dw.IS_WIN and hwnd and dw.user32.IsZoomed(hwnd))
        later = lambda f: threading.Thread(target=f, daemon=True).start()   # never wait on a window's thread here
        if op == "minimize":
            if not dw.show_async(hwnd, dw.SW_MINIMIZE):
                later(w.minimize)
        elif op == "toggle-max":
            was = maximized()
            if not dw.show_async(hwnd, dw.SW_RESTORE if was else dw.SW_MAXIMIZE):
                later(w.restore if was else w.maximize)
            return {"ok": True, "maximized": not was, "chrome": name in chromes,
                    "onTop": bool(state.get("on_top", {}).get(name, getattr(w, "on_top", False)))}
        elif op == "drag":
            dw.mouse_move_or_size(getattr(w, "native", None), hwnd, "caption")
        elif op == "resize":                                # the page's own edges and corners (every window)
            dw.mouse_move_or_size(getattr(w, "native", None), hwnd, str(data.get("edge") or ""))
        elif op == "hide":
            later(hide if name == "main" else (lambda: spotlight(False)) if name == "spotlight" else w.hide)
        elif op == "close":
            if name == "main":
                later(ask_page_about_closing)
            elif name == "teleprompter":
                later(lambda: teleprompter(False))
            elif name == "spotlight":
                later(lambda: spotlight(False))
            else:
                later(w.destroy)
        elif op == "on-top":
            state.setdefault("on_top", {})[name] = bool(data.get("value"))
            if not dw.set_topmost(hwnd, bool(data.get("value"))):
                threading.Thread(target=lambda: setattr(w, "on_top", bool(data.get("value"))), daemon=True).start()
            if name == "teleprompter":
                server.save_app_settings({"prompterOnTop": bool(data.get("value"))})
        elif op == "fit" and name == "spotlight":            # 9.6 compact remote; taller only while search results show
            try:
                height = max(160, min(760, int(data.get("h") or 0)))
            except (TypeError, ValueError):
                height = 620
            if height != state.get("spot_h"):
                state["spot_h"] = height
                later(lambda: w.resize(820, height))
            return {"ok": True}
        elif op == "look" and name == "teleprompter":
            cfg = server.save_app_settings({"prompterLook": str(data.get("look") or "")})
            prompter_look(w, cfg.get("prompterLook", "solid"))
            return {"ok": True, "glass": prompter_glass(), "look": cfg.get("prompterLook", "solid"),
                    "onTop": bool(state.get("on_top", {}).get(name, cfg.get("prompterOnTop", True)))}
        return {"ok": True, "maximized": maximized(), "chrome": name in chromes, "onTop": bool(state.get("on_top", {}).get(name, getattr(w, "on_top", False)))}

    # ---------- 6.8 system-wide shortcut (works while the app is in the tray) ----------
    def on_hotkey(name):
        if name == "spotlight":
            spotlight("toggle")

    hotkeys = dw.Hotkeys(on_hotkey)

    def apply_hotkey(key):
        res = hotkeys.set("spotlight", key)
        if res == "in use by another program" and key == "Alt+Space":     # e.g. PowerToys Run has it
            if hotkeys.set("spotlight", "Ctrl+Alt+Space") == "ok":
                res = "ok (Alt+Space is in use by another program, so Ctrl+Alt+Space is used)"
        server.DESKTOP["hotkey_results"] = {"spotlight": {"key": hotkeys.wanted.get("spotlight", ""), "result": res}}

    def settings_changed(cfg):
        if cfg.get("spotlightKey", "") != hotkeys.wanted.get("spotlight"):
            apply_hotkey(cfg.get("spotlightKey", ""))

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
            except Exception as _e:
                _swallowed("desktop_app.present_fullscreen", _e)
        return bool(state.get("present_fs"))

    def share_annotator(d):
        """9.7 the native Share Window's strokes and pointer, into the shared live state."""
        if d.get("op") == "pointer":
            return server.pointer_set({"on": bool(d.get("on")), "x": d.get("x"), "y": d.get("y")})
        return server.annotate_op(d)

    def spot_word(x, y):
        """9.12.1 the Share Window's double-click or Ctrl twice: the main window lights the word at (x, y) of the picture
        (app/js/annotate.js KCAnnotate.spotAtPicture). False when it could not (the server then lights the point)."""
        try:
            return bool(window.evaluate_js("!!(window.KCAnnotate && KCAnnotate.spotAtPicture(%s, %s))" % (float(x), float(y))))
        except Exception as e:
            print("Spotlight word:", e)
            return False

    def share_annotate(mode):
        """9.7 Draw or Spotlight from Spotlight: the Share Window (the one shared in Zoom or Teams) opens, comes to the
        front and takes the mouse in that mode; '' gives it back its usual behaviour (drag to move)."""
        if mode:
            spotlight(False)
            present(True)
        w = state.get("present")
        if not w:
            return
        if isinstance(w, NativePresentation):
            w.set_annotate(mode, server.ANNOTATE["tool"], server.ANNOTATE["c"])
            if mode:
                dw.bring_to_front(w.hwnd)
            return
        try:
            w.evaluate_js("window.KCShareAnnotate && KCShareAnnotate(%s)" % json.dumps(mode))
            if mode:
                w.restore()
                w.show()
                dw.bring_to_front(window_handle(w))
        except Exception as _e:
            _swallowed("desktop_app.share_annotate", _e)

    def present_open():
        w = state.get("present")
        return bool(w) and (w.is_open() if isinstance(w, NativePresentation) else True)

    def present_fs_state():
        w = state.get("present")
        if isinstance(w, NativePresentation):
            return w.is_open() and w.fullscreen
        return bool(w and state.get("present_fs"))
    server.DESKTOP.update(active=True, show=show, hide=hide, quit=quit_app, choose_folder=choose_folder, window_theme=set_theme,
                          on_remote_change=refresh_tray, present=present, present_fullscreen=present_fullscreen,
                          present_fs_state=present_fs_state, present_open=present_open, teleprompter=teleprompter,
                          teleprompter_open=lambda: bool(state.get("teleprompter")), spotlight=spotlight,
                          palette_index=palette_index, palette_run=palette_run, open_settings=open_settings, win=win,
                          settings_changed=settings_changed, memory_popup=popup_show, popup_op=popup_op,
                          popup_state=popup_state, share_annotate=share_annotate, spot_word=spot_word)
    state["tray"] = build_tray(show, quit_app)
    apply_hotkey(settings.get("spotlightKey", "Alt+Space"))
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
        message("FrameDecks hit an unexpected problem and has to close.\n\n"
                "Details were saved in kc-app-log.txt in your data folder (%APPDATA%\\FRAMEDECKS).", warn=True)
    finally:
        os._exit(0)
