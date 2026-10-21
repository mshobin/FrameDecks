"""Prepares the Windows 11 "KingdomConnect" camera (a Media Foundation virtual camera) before it is compiled.

Takes VCamSample (MIT licence, https://github.com/smourier/VCamSample, a fixed commit) and:
  - replaces its picture (FrameGenerator) with ours: the frames the Kingdom Connect app writes into shared memory
    (vcam/mfcam/FrameGenerator.*, SharedFrame.h)
  - adds what the app calls to show the camera and send it pictures (vcam/mfcam/KcCam.cpp)
  - gives the camera its own Windows ID (CLSID), so it never clashes with other VCamSample-based cameras
  - streams 1920 x 1080 and makes every picture on the CPU (no Direct3D), which every app can receive
Usage:  python packaging/build_mfcam.py <path to VCamSample source>
The ID must match MF_CLSID in vcam/sink.py.
"""
import re
import shutil
import sys
from pathlib import Path

CLSID = "06BACA0B-14C0-4E9B-8161-ED7D11F73518"
HERE = Path(__file__).resolve().parent.parent
OURS = HERE / "vcam" / "mfcam"
OVERLAY = ["FrameGenerator.h", "FrameGenerator.cpp", "SharedFrame.h", "KcCam.cpp"]
EXPORTS = ["KcCamCreate", "KcCamLastError", "KcCamLastStep", "KcCamIsConnected", "KcCamSend", "KcCamDelete"]


def guid_init(g):
    a, b, c, d, e = g.lower().split("-")
    rest = re.findall("..", d + e)
    return "{ 0x%s,0x%s,0x%s,{%s} }" % (a, b, c, ",".join("0x" + x for x in rest))


def read(path):
    return path.read_bytes().decode("utf-8-sig").replace("\r\n", "\n")


def write(path, text, crlf=True):
    path.write_bytes((text.replace("\n", "\r\n") if crlf else text).encode("utf-8"))


def patch(path, replacements, crlf=True):
    text = read(path)
    for old, new in replacements:
        if text.count(old) != 1:
            sys.exit(f"build_mfcam: expected text found {text.count(old)} times in {path.name}: {old!r} (VCamSample changed?)")
        text = text.replace(old, new)
    write(path, text, crlf)


def main(src):
    src = Path(src) / "VCamSampleSource"
    if not (src / "MediaStream.cpp").exists():
        sys.exit(f"build_mfcam: {src} is not VCamSample's media source folder")
    for name in OVERLAY:
        shutil.copyfile(OURS / name, src / name)

    patch(src / "dllmain.cpp", [
        ("// 3cad447d-f283-4af4-a3b2-6f5363309f52\nGUID CLSID_VCam = { 0x3cad447d,0xf283,0x4af4,{0xa3,0xb2,0x6f,0x53,0x63,0x30,0x9f,0x52} };",
         f"// KingdomConnect camera (Windows 11): {CLSID.lower()}\nGUID CLSID_VCam = {guid_init(CLSID)};"),
    ])
    patch(src / "MediaStream.cpp", [
        ("#define NUM_IMAGE_COLS 1280 // 640", "#define NUM_IMAGE_COLS 1920 // Kingdom Connect: 1080p"),
        ("#define NUM_IMAGE_ROWS 960 //480", "#define NUM_IMAGE_ROWS 1080"),
        ("\t// comment these 2 lines to force CPU usage\n"
         "\tRETURN_IF_FAILED(_allocator->SetDirectXManager(manager));\n"
         "\tRETURN_IF_FAILED(_generator.SetD3DManager(manager, NUM_IMAGE_COLS, NUM_IMAGE_ROWS));\n",
         "\t// Kingdom Connect: pictures are made on the CPU (FrameGenerator), so the Direct3D manager is not used\n"),
        ("\t_state = MF_STREAM_STATE_STOPPED;\n", "\t_state = MF_STREAM_STATE_STOPPED;\n\t_generator.Stop();   // Kingdom Connect: tells the app nobody receives the camera\n"),
    ])
    def_file = src / "VCamSampleSource.def"
    text = read(def_file).rstrip("\n") + "\n" + "".join(f"{name}\n" for name in EXPORTS)
    write(def_file, text)
    patch(src / "VCamSampleSource.vcxproj", [
        ('<ClCompile Include="FrameGenerator.cpp" />', '<ClCompile Include="FrameGenerator.cpp" />\n    <ClCompile Include="KcCam.cpp" />'),
        ('<ClInclude Include="FrameGenerator.h" />', '<ClInclude Include="FrameGenerator.h" />\n    <ClInclude Include="SharedFrame.h" />'),
    ])
    print(f"Prepared the KingdomConnect camera (Windows 11) with ID {{{CLSID}}}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "vcamsample")
