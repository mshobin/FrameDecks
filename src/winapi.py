"""FrameDecks - the few Windows jobs the program does outside its own window, through Windows' own interfaces (7.1.1).

Before 7.1.1 these went through hidden PowerShell, netsh and taskkill. An unsigned program that keeps starting hidden
PowerShell (some of it with an encoded command, some bypassing the script policy) looks like remote-control malware to
Microsoft Defender, which quarantined FRAMEDECKS.exe on 31 October 2026. Everything here uses the documented API
instead, and nothing starts a shell:

    run_elevated(file, params)      the Windows "run as administrator" prompt (ShellExecuteEx, verb runas)
    end_other_copies(exe_name)      ends other running copies of this program (Toolhelp + TerminateProcess)
    network_profiles()              connected networks and whether each is Public/Private (Network List Manager)
    firewall_rule_exists(name)      whether the phone remote's firewall rule is there (HNetCfg.FwPolicy2, read-only)
    firewall_apply(action, ...)     adds/removes that rule; needs administrator rights (run through run_elevated)
    authenticode(path)              is a file validly signed, and by whom (WinVerifyTrust)

Also runnable as `FRAMEDECKS.exe --firewall allow|undo --program <exe>` (desktop_app.py hands it here): that is what
"Allow through Windows Firewall" starts with administrator rights. Every function is harmless off Windows.
"""
import ctypes
import os
import sys

IS_WINDOWS = os.name == "nt"
FIREWALL_RULE = "FRAMEDECKS Phone Remote"
OLD_FIREWALL_RULES = ("Kingdom Connect Phone Remote", "BSF Command Center iPad Remote")   # rules of earlier versions


# ---------- "Run as administrator" ----------
def run_elevated(file, params="", timeout=180):
    """Start `file` with administrator rights (Windows shows its permission prompt) and wait for it.
    Returns (outcome, exit code): outcome is "done", "cancelled" (permission not given), "timeout" or "error"."""
    if not IS_WINDOWS:
        return "error", None
    from ctypes import wintypes

    class SHELLEXECUTEINFOW(ctypes.Structure):
        _fields_ = [("cbSize", wintypes.DWORD), ("fMask", ctypes.c_ulong), ("hwnd", wintypes.HWND),
                    ("lpVerb", wintypes.LPCWSTR), ("lpFile", wintypes.LPCWSTR), ("lpParameters", wintypes.LPCWSTR),
                    ("lpDirectory", wintypes.LPCWSTR), ("nShow", ctypes.c_int), ("hInstApp", wintypes.HINSTANCE),
                    ("lpIDList", ctypes.c_void_p), ("lpClass", wintypes.LPCWSTR), ("hkeyClass", wintypes.HKEY),
                    ("dwHotKey", wintypes.DWORD), ("hIconOrMonitor", wintypes.HANDLE), ("hProcess", wintypes.HANDLE)]
    SEE_MASK_NOCLOSEPROCESS, SEE_MASK_NOASYNC = 0x40, 0x100
    info = SHELLEXECUTEINFOW()
    info.cbSize = ctypes.sizeof(info)
    info.fMask = SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC
    info.lpVerb, info.lpFile, info.lpParameters, info.nShow = "runas", str(file), params or None, 0   # SW_HIDE
    shell32 = ctypes.WinDLL("shell32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    shell32.ShellExecuteExW.argtypes = [ctypes.POINTER(SHELLEXECUTEINFOW)]
    shell32.ShellExecuteExW.restype = wintypes.BOOL
    kernel32.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    kernel32.WaitForSingleObject.restype = wintypes.DWORD
    kernel32.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    if not shell32.ShellExecuteExW(ctypes.byref(info)):
        return ("cancelled" if ctypes.get_last_error() == 1223 else "error"), None     # 1223: ERROR_CANCELLED
    if not info.hProcess:
        return "done", 0
    try:
        if kernel32.WaitForSingleObject(info.hProcess, int(timeout * 1000)) != 0:
            return "timeout", None
        code = wintypes.DWORD()
        kernel32.GetExitCodeProcess(info.hProcess, ctypes.byref(code))
        return "done", code.value
    finally:
        kernel32.CloseHandle(info.hProcess)


# ---------- Other copies of this program ----------
def processes():
    """[(pid, parent pid, exe name)] of every running process (Toolhelp snapshot)."""
    if not IS_WINDOWS:
        return []
    from ctypes import wintypes

    class PROCESSENTRY32W(ctypes.Structure):
        _fields_ = [("dwSize", wintypes.DWORD), ("cntUsage", wintypes.DWORD), ("th32ProcessID", wintypes.DWORD),
                    ("th32DefaultHeapID", ctypes.c_size_t), ("th32ModuleID", wintypes.DWORD), ("cntThreads", wintypes.DWORD),
                    ("th32ParentProcessID", wintypes.DWORD), ("pcPriClassBase", ctypes.c_long), ("dwFlags", wintypes.DWORD),
                    ("szExeFile", ctypes.c_wchar * 260)]
    k = ctypes.WinDLL("kernel32", use_last_error=True)
    k.CreateToolhelp32Snapshot.argtypes = [wintypes.DWORD, wintypes.DWORD]
    k.CreateToolhelp32Snapshot.restype = wintypes.HANDLE
    k.Process32FirstW.argtypes = k.Process32NextW.argtypes = [wintypes.HANDLE, ctypes.POINTER(PROCESSENTRY32W)]
    k.CloseHandle.argtypes = [wintypes.HANDLE]
    snap = k.CreateToolhelp32Snapshot(0x2, 0)                  # TH32CS_SNAPPROCESS
    if not snap or snap == wintypes.HANDLE(-1).value:
        return []
    out, e = [], PROCESSENTRY32W()
    e.dwSize = ctypes.sizeof(e)
    try:
        ok = k.Process32FirstW(snap, ctypes.byref(e))
        while ok:
            out.append((e.th32ProcessID, e.th32ParentProcessID, e.szExeFile))
            ok = k.Process32NextW(snap, ctypes.byref(e))
    finally:
        k.CloseHandle(snap)
    return out


def end_other_copies(exe_name, keep=None):
    """End every process named `exe_name` except this one and its own watchdog (the parent that started it).
    Returns how many were ended."""
    if not IS_WINDOWS:
        return 0
    from ctypes import wintypes
    me = os.getpid()
    procs = processes()
    parent = next((pp for pid, pp, _ in procs if pid == me), None)
    spare = {me, parent} | set(keep or ())
    k = ctypes.WinDLL("kernel32", use_last_error=True)
    k.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    k.OpenProcess.restype = wintypes.HANDLE
    k.TerminateProcess.argtypes = [wintypes.HANDLE, wintypes.UINT]
    k.CloseHandle.argtypes = [wintypes.HANDLE]
    ended = 0
    for pid, _, name in procs:
        if name.lower() != exe_name.lower() or pid in spare:
            continue
        h = k.OpenProcess(0x0001, False, pid)                  # PROCESS_TERMINATE
        if h:
            try:
                ended += bool(k.TerminateProcess(h, 1))
            finally:
                k.CloseHandle(h)
    return ended


# ---------- Network type and the phone remote's firewall rule (read-only) ----------
def _com():
    import comtypes
    import comtypes.client
    comtypes.CoInitialize()
    return comtypes, comtypes.client


CATEGORIES = {0: "Public", 1: "Private", 2: "DomainAuthenticated"}


def network_profiles():
    """The connected networks: [{"name", "adapter", "category"}] (category Public/Private/DomainAuthenticated)."""
    if not IS_WINDOWS:
        return []
    comtypes, client = _com()
    try:
        nlm = client.CreateObject("{DCB00C01-570F-4A9B-8D69-199FDBA5723B}", dynamic=True)   # NetworkListManager
        out = []
        for net in nlm.GetNetworks(1):                         # NLM_ENUM_NETWORK_CONNECTED
            cat = net.GetCategory()
            out.append({"name": net.GetName(), "adapter": None, "category": CATEGORIES.get(cat, cat)})
        return out
    finally:
        comtypes.CoUninitialize()


def _rule_exists(fw, name):
    try:
        fw.Rules.Item(name)
        return True
    except Exception:
        return False


def firewall_rule_exists(name=FIREWALL_RULE):
    if not IS_WINDOWS:
        return None
    comtypes, client = _com()
    try:
        return _rule_exists(client.CreateObject("HNetCfg.FwPolicy2", dynamic=True), name)
    finally:
        comtypes.CoUninitialize()


def firewall_apply(action, program, name=FIREWALL_RULE, old=OLD_FIREWALL_RULES):
    """allow: inbound TCP for `program` only, on Private networks only. undo: remove it. Needs administrator rights.
    Earlier versions' rules are removed either way. Returns True when the rule is as asked."""
    comtypes, client = _com()
    try:
        fw = client.CreateObject("HNetCfg.FwPolicy2", dynamic=True)
        for n in tuple(old) + (name,):
            for _ in range(10):                                # Remove takes one rule of that name at a time
                if not _rule_exists(fw, n):
                    break
                fw.Rules.Remove(n)
        if action == "allow":
            rule = client.CreateObject("HNetCfg.FWRule", dynamic=True)
            rule.Name = name
            rule.Description = "Lets phones and tablets on a private network reach the FrameDecks phone remote."
            rule.ApplicationName = str(program)
            rule.Protocol = 6                                  # TCP
            rule.Direction = 1                                 # inbound
            rule.Action = 1                                    # allow
            rule.Profiles = 2                                  # Private networks only
            rule.Enabled = True
            fw.Rules.Add(rule)
        return _rule_exists(fw, name) == (action == "allow")
    finally:
        comtypes.CoUninitialize()


def firewall_main(argv):
    """`--firewall allow|undo --program <exe>`, run with administrator rights. Exit code 0 = done."""
    try:
        action = argv[argv.index("--firewall") + 1]
        program = argv[argv.index("--program") + 1]
    except (ValueError, IndexError):
        return 2
    if action not in ("allow", "undo"):
        return 2
    try:
        return 0 if firewall_apply(action, program) else 1
    except Exception:
        return 1


# ---------- Authenticode ----------
def authenticode(path):
    """(valid, signer name) for a file's embedded Authenticode signature; (False, "") when unsigned or invalid."""
    if not IS_WINDOWS:
        return False, ""
    from ctypes import wintypes

    class GUID(ctypes.Structure):
        _fields_ = [("Data1", wintypes.DWORD), ("Data2", wintypes.WORD), ("Data3", wintypes.WORD), ("Data4", ctypes.c_ubyte * 8)]

    class WINTRUST_FILE_INFO(ctypes.Structure):
        _fields_ = [("cbStruct", wintypes.DWORD), ("pcwszFilePath", wintypes.LPCWSTR), ("hFile", wintypes.HANDLE),
                    ("pgKnownSubject", ctypes.c_void_p)]

    class WINTRUST_DATA(ctypes.Structure):
        _fields_ = [("cbStruct", wintypes.DWORD), ("pPolicyCallbackData", ctypes.c_void_p), ("pSIPClientData", ctypes.c_void_p),
                    ("dwUIChoice", wintypes.DWORD), ("fdwRevocationChecks", wintypes.DWORD), ("dwUnionChoice", wintypes.DWORD),
                    ("pFile", ctypes.POINTER(WINTRUST_FILE_INFO)), ("dwStateAction", wintypes.DWORD),
                    ("hWVTStateData", wintypes.HANDLE), ("pwszURLReference", wintypes.LPCWSTR), ("dwProvFlags", wintypes.DWORD),
                    ("dwUIContext", wintypes.DWORD), ("pSignatureSettings", ctypes.c_void_p)]

    class CRYPT_PROVIDER_CERT(ctypes.Structure):           # only the first two fields are read
        _fields_ = [("cbStruct", wintypes.DWORD), ("pCert", ctypes.c_void_p)]

    action = GUID(0x00AAC56B, 0xCD44, 0x11D0, (ctypes.c_ubyte * 8)(0x8C, 0xC2, 0x00, 0xC0, 0x4F, 0xC2, 0x95, 0xEE))  # GENERIC_VERIFY_V2
    wt = ctypes.WinDLL("wintrust")
    crypt = ctypes.WinDLL("crypt32")
    wt.WinVerifyTrust.argtypes = [wintypes.HWND, ctypes.POINTER(GUID), ctypes.POINTER(WINTRUST_DATA)]
    wt.WinVerifyTrust.restype = ctypes.c_long
    wt.WTHelperProvDataFromStateData.argtypes = [wintypes.HANDLE]
    wt.WTHelperProvDataFromStateData.restype = ctypes.c_void_p
    wt.WTHelperGetProvSignerFromChain.argtypes = [ctypes.c_void_p, wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    wt.WTHelperGetProvSignerFromChain.restype = ctypes.c_void_p
    wt.WTHelperGetProvCertFromChain.argtypes = [ctypes.c_void_p, wintypes.DWORD]
    wt.WTHelperGetProvCertFromChain.restype = ctypes.POINTER(CRYPT_PROVIDER_CERT)
    crypt.CertGetNameStringW.argtypes = [ctypes.c_void_p, wintypes.DWORD, wintypes.DWORD, ctypes.c_void_p,
                                         wintypes.LPWSTR, wintypes.DWORD]
    crypt.CertGetNameStringW.restype = wintypes.DWORD
    info = WINTRUST_FILE_INFO(ctypes.sizeof(WINTRUST_FILE_INFO), str(path), None, None)
    data = WINTRUST_DATA()
    data.cbStruct = ctypes.sizeof(WINTRUST_DATA)
    data.dwUIChoice, data.fdwRevocationChecks, data.dwUnionChoice = 2, 0, 1      # no UI, no revocation, a file
    data.pFile = ctypes.pointer(info)
    data.dwStateAction = 1                                                        # verify, keep the state
    valid, name = False, ""
    try:
        valid = wt.WinVerifyTrust(None, ctypes.byref(action), ctypes.byref(data)) == 0
        if valid and data.hWVTStateData:
            prov = wt.WTHelperProvDataFromStateData(data.hWVTStateData)
            sgnr = wt.WTHelperGetProvSignerFromChain(prov, 0, False, 0) if prov else None
            cert = wt.WTHelperGetProvCertFromChain(sgnr, 0) if sgnr else None
            if cert and cert.contents.pCert:
                buf = ctypes.create_unicode_buffer(512)
                crypt.CertGetNameStringW(cert.contents.pCert, 4, 0, None, buf, 512)     # CERT_NAME_SIMPLE_DISPLAY_TYPE
                name = buf.value
    finally:
        data.dwStateAction = 2                                                    # close the state
        wt.WinVerifyTrust(None, ctypes.byref(action), ctypes.byref(data))
    return valid, name


if __name__ == "__main__":
    sys.exit(firewall_main(sys.argv))
