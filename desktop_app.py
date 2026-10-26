"""
FRAMEDECKS - Windows desktop app.

Runs the same local program as server.py, shows the dashboard in its own window, and keeps an icon
near the clock (the "tray") so the overlays keep working in OBS/Camo when the window is closed.

Only one copy runs at a time: opening the app again brings the existing window to the front.
6.11: the website's "Open FRAMEDECKS on this PC" starts it through a framedecks:// link (registered by the
installer). That is the same as opening it: the link is never read, so a web page cannot make it do anything else.
"""
import json
import os
import sys
import threading
import time
import traceback
import urllib.request
import webbrowser

if __name__ == "__main__":
    import supervisor              # the installed app first starts as a small watchdog (restarts it after a crash)
    if supervisor.wanted():
        sys.exit(supervisor.run())

APP_NAME = "FRAMEDECKS"          # identity: data folder name and the single-instance check
DISPLAY_NAME = "FRAMEDECKS"     # what people see


# ---------- A windowed app has no console: send messages to a small log file instead ----------
def _setup_log():
    if not os.environ.get("KC_DATA_DIR"):
        try:                                   # 6.9: data saved under the earlier name moves first, before any file opens
            import legacy
            legacy.migrate_app_data(os.environ.get("APPDATA") or os.path.expanduser("~"))
        except Exception:
            pass
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
    import subprocess
    exe = os.path.basename(sys.executable)
    try:
        r = subprocess.run(["taskkill", "/F", "/IM", exe, "/FI", f"PID ne {os.getpid()}"], capture_output=True, text=True,
                           timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        print("Ended a copy that had stopped answering:", (r.stdout or r.stderr).strip())
    except Exception as e:
        print("Could not end the earlier copy:", e)
        return False
    time.sleep(1.0)                                     # Windows frees the port when the process is gone
    return True


START_FILES_RUNNING = ("The start-file version of FRAMEDECKS is still running (the black window).\n\n"
                       "Close that black window first, then open FRAMEDECKS again.\n\n"
                       "Only one copy can run at a time, and only the installed app has FRAMEDECKS.")


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
        except Exception:
            pass
        return
    if other == "stuck":
        end_stuck_copies()

    srv = server.start_main_server()
    if srv is None:
        message("FRAMEDECKS could not start because ports 8750-8760 are all in use.\n\n"
                "Close the other program using them, then open FRAMEDECKS again.", warn=True)
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
        message(f"Another program is using port {server.PREFERRED_PORT}, so FRAMEDECKS is using port {port} today.\n\n"
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
            pystray.MenuItem("Teleprompter", hook("overlay", "toggle"),
                             checked=lambda item: bool(server.DESKTOP.get("overlay_open") and server.DESKTOP["overlay_open"]())),
            pystray.MenuItem("Search", hook("spotlight", True)),
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
            except Exception:
                pass

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
            except Exception:
                pass
        if state["tray"]:
            try:
                state["tray"].stop()
            except Exception:
                pass
        try:
            srv.shutdown()
            srv.server_close()           # 6.10: free the port at once, so the next start gets it
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
            message(f"FRAMEDECKS is open in {where}.\n\nIt keeps running in the background (so your overlays keep "
                    "working) until you restart or sign out of Windows.")
        done.wait()
        stop_everything()
        return

    webview.settings["ALLOW_DOWNLOADS"] = True                 # backups and Excel exports
    webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True  # WhatsApp etc. open in your browser
    window = webview.create_window(DISPLAY_NAME, url, width=1440, height=900, min_size=(1000, 640),
                                   background_color="#070c18", text_select=True)
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
        """Quit (the page's close dialog or the tray). 6.10: every window must close, the hidden Spotlight window
        too: while one is left, webview.start() does not return and the process stays behind. A safety net ends the
        process if a window will not close."""
        state["quitting"] = True
        stop_everything()
        threading.Timer(5.0, lambda: os._exit(0)).start()
        for close in (lambda: present(False), lambda: overlay(False), lambda: state.get("speaker") and state["speaker"].destroy(),
                      lambda: spot.destroy(), lambda: window.destroy()):
            try:
                close()
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
        """The separate "FRAMEDECKS Share Window" window (Zoom > Share Screen > that window).
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
        w = webview.create_window("FRAMEDECKS Share Window", url + "present.html", width=1280, height=720,
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
                                  min_size=(640, 420), background_color="#070c18", text_select=True)
        def closed():
            if state.get("speaker") is w:
                state["speaker"] = None
            chromes.pop("teleprompter", None)
        def shown():
            add_chrome("teleprompter", w)
            dw.hide_from_capture(window_handle(w))     # only the leader sees it, even when sharing the whole screen
        w.events.closed += closed
        w.events.shown += shown
        state["speaker"] = w

    # ---------- 6.8 Teleprompter overlay (Meeting Leader mode): see-through, above Zoom / Teams, not in screen shares
    OVERLAY_FADE = {"solid": 1.0, "presenter": 0.85, "meeting": 0.65, "conference": 0.4, "ghost": 0.2}

    def overlay_look(w, look):
        """Glass: the page's own translucent background, the text stays solid. Fade (compatibility): the window."""
        hwnd = window_handle(w)
        if look.get("overlayFade") or server.DESKTOP.get("low_gpu"):
            dw.fade(hwnd, OVERLAY_FADE.get(look.get("overlayMode"), 0.65))
        else:
            dw.glass(hwnd, bool(look.get("overlayFrost")))

    def overlay(on="toggle"):
        w = state.get("overlay")
        if on == "toggle":
            on = not w
        if not on:
            state["overlay"] = None
            if w:
                try:
                    w.destroy()
                except Exception:
                    pass
            refresh_tray()
            return False
        if w:
            try:
                w.restore()
                w.show()
                dw.bring_to_front(window_handle(w))
                return True
            except Exception:
                state["overlay"] = None
        cfg = server.app_settings()
        # see-through text needs the graphics card: with "Light on graphics card" on, the whole window fades instead
        fade = bool(cfg.get("overlayFade") or server.DESKTOP.get("low_gpu"))
        w = webview.create_window(DISPLAY_NAME + " · Teleprompter overlay", url + "prompter.html", width=1100, height=640,
                                  min_size=(420, 240), background_color="#000000", text_select=True,
                                  transparent=not fade, on_top=bool(cfg.get("overlayOnTop", True)))
        def shown():
            if not add_chrome("overlay", w):                      # the overlay never has a title bar
                c = dw.Chrome(window_handle(w))
                if c.ok:
                    chromes["overlay"] = c                           # keep it: its window procedure lives in it
            overlay_look(w, server.app_settings())
            dw.hide_from_capture(window_handle(w))
        def closed():
            if state.get("overlay") is w:
                state["overlay"] = None
            chromes.pop("overlay", None)
            refresh_tray()
        w.events.shown += shown
        w.events.closed += closed
        state["overlay"] = w
        refresh_tray()
        return True

    # ---------- 6.8 Spotlight: one small window, made at start-up and only shown and hidden (instant) ----------
    spot = webview.create_window(DISPLAY_NAME + " · Spotlight", url + "spotlight.html", width=760, height=500,
                                 background_color="#0f172b", frameless=True, easy_drag=False, hidden=True,
                                 on_top=True, text_select=False)
    state["spot_ready"] = False

    def spotlight(on=True):
        hwnd = window_handle(spot)
        if on == "toggle":
            on = not state.get("spot_open")
        if not on:
            state["spot_open"] = False
            try:
                spot.hide()
            except Exception:
                pass
            return
        if not state["spot_ready"]:
            dw.round_corners(hwnd)
            dw.hide_from_capture(hwnd)
            state["spot_ready"] = True
        dw.center_on_cursor(hwnd)
        state["spot_open"] = True
        try:
            spot.show()
        except Exception:
            pass
        dw.bring_to_front(hwnd)
        try:
            spot.evaluate_js("window.KCSpotlight && KCSpotlight.opened()")
        except Exception:
            pass

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
        except Exception:
            pass

    # ---------- 6.8 the page's window buttons and ribbon ----------
    def win(name, op, data):
        w = {"main": window, "teleprompter": state.get("speaker"), "overlay": state.get("overlay"), "spotlight": spot}.get(name)
        if w is None:
            return {"ok": False}
        hwnd = window_handle(w)
        maximized = lambda: bool(dw.IS_WIN and hwnd and dw.user32.IsZoomed(hwnd))
        if op == "minimize":
            w.minimize()
        elif op == "toggle-max":
            (w.restore if maximized() else w.maximize)()
        elif op == "drag":
            dw.mouse_move_or_size(getattr(w, "native", None), hwnd, "caption")
        elif op == "resize":                                # the page's own edges and corners (every window)
            dw.mouse_move_or_size(getattr(w, "native", None), hwnd, str(data.get("edge") or ""))
        elif op == "hide":
            hide() if name == "main" else (spotlight(False) if name == "spotlight" else w.hide())
        elif op == "close":
            if name == "main":
                threading.Thread(target=ask_page_about_closing, daemon=True).start()
            elif name == "overlay":
                overlay(False)
            elif name == "spotlight":
                spotlight(False)
            else:
                w.destroy()
        elif op == "on-top":
            w.on_top = bool(data.get("value"))
            if name == "overlay":
                server.save_app_settings({"overlayOnTop": bool(data.get("value"))})
        elif op == "look" and name == "overlay":
            changes = {k: data[k] for k in ("overlayMode", "overlayFrost", "overlayFade") if k in data}
            low = bool(server.DESKTOP.get("low_gpu"))
            before = server.app_settings().get("overlayFade") or low
            cfg = server.save_app_settings(changes)
            if bool(cfg.get("overlayFade") or low) != bool(before):  # glass <-> fade needs a new window
                threading.Thread(target=lambda: (overlay(False), time.sleep(0.3), overlay(True)), daemon=True).start()
            else:
                overlay_look(w, cfg)
        return {"ok": True, "maximized": maximized(), "chrome": name in chromes, "onTop": bool(getattr(w, "on_top", False))}

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
    server.DESKTOP.update(active=True, show=show, hide=hide, quit=quit_app, choose_folder=choose_folder, window_theme=set_theme,
                          on_remote_change=refresh_tray, present=present, present_fullscreen=present_fullscreen,
                          present_fs_state=present_fs_state, present_open=present_open, speaker=speaker,
                          overlay=overlay, overlay_open=lambda: bool(state.get("overlay")), spotlight=spotlight,
                          palette_index=palette_index, palette_run=palette_run, open_settings=open_settings, win=win,
                          settings_changed=settings_changed)
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
        message("FRAMEDECKS hit an unexpected problem and has to close.\n\n"
                "Details were saved in kc-app-log.txt in your data folder (%APPDATA%\\FRAMEDECKS).", warn=True)
    finally:
        os._exit(0)
