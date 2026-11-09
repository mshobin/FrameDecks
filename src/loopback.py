"""FrameDecks 26.11.24 - the meeting's own sound, for Listen for scripture (members saying a verse).

What this PC plays (Zoom, Teams: the other people in the meeting) is read with Windows' WASAPI loopback, built into
Windows (no extra package, no driver, no "Stereo Mix"), turned into 16 kHz mono 16-bit sound like the microphone, and
heard only by the scripture grammar in src/voice_worker.py. Nothing is recorded or kept: each 0.1 s of sound is given to
the speech engine and dropped.

Loopback(): .read() -> 0.1 s of sound (silence when nothing plays), .close(). Windows only; Resampler is plain Python
and is tested everywhere.
"""

import array
import ctypes
import sys
import time

RATE = 16000
CHUNK = RATE // 10                 # 0.1 s, as the microphone gives it


class Resampler:
    """The mix format (any rate, any channels; 32-bit float, or 16/32-bit integer) -> 16 kHz mono 16-bit bytes.
    Each output sample is the average of the input samples it covers (a box filter: little aliasing, cheap)."""

    def __init__(self, rate, channels, kind="float", bits=32):
        if kind not in ("float", "int") or (kind == "int" and bits not in (16, 32)) or (kind == "float" and bits != 32):
            raise ValueError("This sound format is not supported (%s %d-bit)." % (kind, bits))
        self.step = float(rate) / RATE
        self.channels = max(1, int(channels))
        self.code = "f" if kind == "float" else ("h" if bits == 16 else "i")
        self.scale = 1.0 if kind == "float" else (32768.0 if bits == 16 else 2147483648.0)
        self.acc, self.n, self.phase = 0.0, 0, 0.0
        self.rest = b""

    def feed(self, raw):
        width = array.array(self.code).itemsize * self.channels
        raw = self.rest + raw
        cut = len(raw) - len(raw) % width
        self.rest, raw = raw[cut:], raw[:cut]
        if not raw:
            return b""
        a = array.array(self.code)
        a.frombytes(raw)
        if sys.byteorder != "little":
            a.byteswap()
        out = array.array("h")
        ch, step = self.channels, self.step
        scale = self.scale * ch
        acc, n, phase = self.acc, self.n, self.phase
        for i in range(0, len(a), ch):
            s = a[i] if ch == 1 else (a[i] + a[i + 1] if ch == 2 else sum(a[i:i + ch]))
            acc += s / scale
            n += 1
            phase += 1.0
            if phase >= step:
                v = acc / n
                out.append(32767 if v >= 1.0 else -32768 if v <= -1.0 else int(v * 32767))
                acc, n, phase = 0.0, 0, phase - step
        self.acc, self.n, self.phase = acc, n, phase
        return out.tobytes()


# ---------- Windows: WASAPI loopback through COM, with ctypes ----------
class _GUID(ctypes.Structure):
    _fields_ = [("Data1", ctypes.c_uint32), ("Data2", ctypes.c_uint16), ("Data3", ctypes.c_uint16), ("Data4", ctypes.c_ubyte * 8)]


def _guid(s):
    h = s.replace("-", "")
    return _GUID(int(h[0:8], 16), int(h[8:12], 16), int(h[12:16], 16), (ctypes.c_ubyte * 8)(*bytes.fromhex(h[16:32])))


class _WAVEFORMATEX(ctypes.Structure):
    _fields_ = [("wFormatTag", ctypes.c_uint16), ("nChannels", ctypes.c_uint16), ("nSamplesPerSec", ctypes.c_uint32),
                ("nAvgBytesPerSec", ctypes.c_uint32), ("nBlockAlign", ctypes.c_uint16), ("wBitsPerSample", ctypes.c_uint16),
                ("cbSize", ctypes.c_uint16)]


class _WAVEFORMATEXTENSIBLE(ctypes.Structure):
    _fields_ = [("Format", _WAVEFORMATEX), ("wValidBitsPerSample", ctypes.c_uint16), ("dwChannelMask", ctypes.c_uint32),
                ("SubFormat", _GUID)]


CLSID_MMDeviceEnumerator = "BCDE0395-E52F-467C-8E3D-C4579291692E"
IID_IMMDeviceEnumerator = "A95664D2-9614-4F35-A746-DE8DB63617E6"
IID_IAudioClient = "1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"
IID_IAudioCaptureClient = "C8ADBD64-E71E-48A0-A4DE-185C395CD317"
CLSCTX_ALL = 0x17
AUDCLNT_STREAMFLAGS_LOOPBACK = 0x00020000
AUDCLNT_BUFFERFLAGS_SILENT = 0x2
WAVE_FORMAT_PCM, WAVE_FORMAT_IEEE_FLOAT, WAVE_FORMAT_EXTENSIBLE = 1, 3, 0xFFFE


def _method(obj, index, *argtypes):
    """COM method number `index` of the interface pointer `obj` (a c_void_p), called with HRESULT checking."""
    vtbl = ctypes.cast(obj, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
    proto = ctypes.WINFUNCTYPE(ctypes.HRESULT, ctypes.c_void_p, *argtypes)
    fn = proto(vtbl[index])
    return lambda *a: fn(obj, *a)


def _release(obj):
    if obj and obj.value:
        vtbl = ctypes.cast(obj, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
        ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p)(vtbl[2])(obj)


class Loopback:
    """What the default speakers play, as the microphone gives it (Windows). read() waits up to 0.1 s."""

    def __init__(self):
        if sys.platform != "win32":
            raise RuntimeError("Hearing the meeting needs Windows.")
        self.ole = ctypes.OleDLL("ole32")
        ctypes.windll.ole32.CoInitializeEx(None, 0)          # this thread, multithreaded; "already done" is fine
        self.enum, self.device, self.client, self.capture = (ctypes.c_void_p() for _ in range(4))
        self.pwfx = ctypes.POINTER(_WAVEFORMATEX)()
        try:
            self.ole.CoCreateInstance(ctypes.byref(_guid(CLSID_MMDeviceEnumerator)), None, CLSCTX_ALL,
                                      ctypes.byref(_guid(IID_IMMDeviceEnumerator)), ctypes.byref(self.enum))
            # IMMDeviceEnumerator::GetDefaultAudioEndpoint(eRender = 0, eConsole = 0, &device)
            _method(self.enum, 4, ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_void_p))(0, 0, ctypes.byref(self.device))
            # IMMDevice::Activate(IID_IAudioClient, CLSCTX_ALL, NULL, &client)
            _method(self.device, 3, ctypes.POINTER(_GUID), ctypes.c_uint32, ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p))(
                ctypes.byref(_guid(IID_IAudioClient)), CLSCTX_ALL, None, ctypes.byref(self.client))
            # IAudioClient::GetMixFormat(&pwfx)
            _method(self.client, 8, ctypes.POINTER(ctypes.POINTER(_WAVEFORMATEX)))(ctypes.byref(self.pwfx))
            fmt = self.pwfx.contents
            kind = "float" if fmt.wFormatTag == WAVE_FORMAT_IEEE_FLOAT else "int"
            if fmt.wFormatTag == WAVE_FORMAT_EXTENSIBLE:
                ext = ctypes.cast(self.pwfx, ctypes.POINTER(_WAVEFORMATEXTENSIBLE)).contents
                kind = "float" if ext.SubFormat.Data1 == WAVE_FORMAT_IEEE_FLOAT else "int"
            self.block = fmt.nBlockAlign
            self.resampler = Resampler(fmt.nSamplesPerSec, fmt.nChannels, kind, fmt.wBitsPerSample)
            # IAudioClient::Initialize(shared, loopback, 1 s buffer, 0, format, NULL)
            _method(self.client, 3, ctypes.c_int, ctypes.c_uint32, ctypes.c_longlong, ctypes.c_longlong,
                    ctypes.POINTER(_WAVEFORMATEX), ctypes.c_void_p)(0, AUDCLNT_STREAMFLAGS_LOOPBACK, 10_000_000, 0, self.pwfx, None)
            # IAudioClient::GetService(IID_IAudioCaptureClient, &capture)
            _method(self.client, 14, ctypes.POINTER(_GUID), ctypes.POINTER(ctypes.c_void_p))(
                ctypes.byref(_guid(IID_IAudioCaptureClient)), ctypes.byref(self.capture))
            _method(self.client, 10)()                         # IAudioClient::Start
        except OSError as e:
            self.close()
            raise RuntimeError("The meeting's sound could not be heard (%s)." % e)
        self._get = _method(self.capture, 3, ctypes.POINTER(ctypes.c_void_p), ctypes.POINTER(ctypes.c_uint32),
                            ctypes.POINTER(ctypes.c_uint32), ctypes.c_void_p, ctypes.c_void_p)
        self._free = _method(self.capture, 4, ctypes.c_uint32)
        self._size = _method(self.capture, 5, ctypes.POINTER(ctypes.c_uint32))
        self.buf = b""

    def _drain(self):
        n, data, frames, flags = ctypes.c_uint32(), ctypes.c_void_p(), ctypes.c_uint32(), ctypes.c_uint32()
        self._size(ctypes.byref(n))
        while n.value:
            self._get(ctypes.byref(data), ctypes.byref(frames), ctypes.byref(flags), None, None)
            size = frames.value * self.block
            raw = b"\0" * size if flags.value & AUDCLNT_BUFFERFLAGS_SILENT or not data.value else ctypes.string_at(data, size)
            self._free(frames.value)
            self.buf += self.resampler.feed(raw)
            self._size(ctypes.byref(n))

    def read(self):
        """The next 0.1 s: what played, or silence when nothing did (loopback sends nothing while all is quiet)."""
        end = time.monotonic() + 0.1
        while len(self.buf) < CHUNK * 2:
            self._drain()
            if time.monotonic() >= end:
                self.buf += b"\0" * (CHUNK * 2 - len(self.buf))
                break
            time.sleep(0.01)
        out, self.buf = self.buf[:CHUNK * 2], self.buf[CHUNK * 2:]
        return out

    def close(self):
        try:
            if self.client and self.client.value:
                _method(self.client, 11)()                     # IAudioClient::Stop
        except OSError:
            pass
        for o in (self.capture, self.client, self.device, self.enum):
            try:
                _release(o)
            except OSError:
                pass
        if self.pwfx:
            ctypes.windll.ole32.CoTaskMemFree(self.pwfx)
            self.pwfx = None
        self.capture = self.client = self.device = self.enum = ctypes.c_void_p()
