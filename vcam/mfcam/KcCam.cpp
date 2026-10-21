// Kingdom Connect: what the Kingdom Connect app calls (through ctypes, see vcam/sink.py MFSink) to show the
// KingdomConnect camera on Windows 11 and send it pictures. The same shape as softcam's scCreateCamera /
// scSendFrame / scIsConnected / scDeleteCamera, so the app's camera engine uses either camera the same way.
//
// The camera is created for the signed-in user and lasts as long as the app keeps it (MFVirtualCameraLifetime_Session),
// so creating it needs no administrator permission. Registering the media source with Windows (regsvr32, once)
// does: see vcam/bin/register-kingdomconnect-camera.cmd.
#include "pch.h"
#include "Undocumented.h"
#include "Tools.h"
#include "SharedFrame.h"

extern GUID CLSID_VCam;

struct KcCam
{
	wil::com_ptr_nothrow<IMFVirtualCamera> vcam;
	HANDLE mapping = nullptr;
	KcFrameHeader* header = nullptr;
	bool comInit = false;
	bool mfInit = false;
};

static volatile HRESULT _lastError = S_OK;

static bool OpenFrames(KcCam* cam)
{
	if (cam->header)
		return true;
	cam->mapping = OpenFileMappingW(FILE_MAP_READ | FILE_MAP_WRITE, FALSE, KC_FRAME_NAME);
	if (!cam->mapping)
		return false;   // no app has started using the camera yet
	cam->header = (KcFrameHeader*)MapViewOfFile(cam->mapping, FILE_MAP_READ | FILE_MAP_WRITE, 0, 0, 0);
	if (!cam->header || cam->header->magic != KC_FRAME_MAGIC || cam->header->version != KC_FRAME_VERSION)
	{
		if (cam->header)
			UnmapViewOfFile(cam->header);
		cam->header = nullptr;
		CloseHandle(cam->mapping);
		cam->mapping = nullptr;
		return false;
	}
	return true;
}

static void Release(KcCam* cam)
{
	if (cam->vcam)
	{
		LOG_IF_FAILED(cam->vcam->Remove());
		cam->vcam.reset();
	}
	if (cam->header)
		UnmapViewOfFile(cam->header);
	if (cam->mapping)
		CloseHandle(cam->mapping);
	if (cam->mfInit)
		MFShutdown();
	if (cam->comInit)
		CoUninitialize();
	delete cam;
}

// Shows the KingdomConnect camera to Zoom, Teams, OBS and the other apps of the signed-in user. Null when Windows
// refused (KcCamLastError tells why: 0x80040154 = the media source is not registered).
extern "C" void* __cdecl KcCamCreate(const wchar_t* friendlyName)
{
	auto cam = new (std::nothrow) KcCam();
	if (!cam)
		return nullptr;
	auto hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
	cam->comInit = SUCCEEDED(hr);   // RPC_E_CHANGED_MODE: this thread already has COM, which is fine
	hr = MFStartup(MF_VERSION);
	if (SUCCEEDED(hr))
	{
		cam->mfInit = true;
		auto clsid = GUID_ToStringW(CLSID_VCam, false);   // "{…}" (true would give the name "CLSID_VCam")
		hr = MFCreateVirtualCamera(
			MFVirtualCameraType_SoftwareCameraSource,
			MFVirtualCameraLifetime_Session,
			MFVirtualCameraAccess_CurrentUser,
			friendlyName && *friendlyName ? friendlyName : L"KingdomConnect",
			clsid.c_str(),
			nullptr,
			0,
			&cam->vcam);
	}
	if (SUCCEEDED(hr))
		hr = cam->vcam->Start(nullptr);
	_lastError = hr;
	if (FAILED(hr))
	{
		Release(cam);
		return nullptr;
	}
	return cam;
}

extern "C" int __cdecl KcCamLastError()
{
	return (int)_lastError;
}

// 1 while an app (Zoom, Teams, OBS…) is receiving the camera.
extern "C" int __cdecl KcCamIsConnected(void* handle)
{
	auto cam = (KcCam*)handle;
	if (!cam || !OpenFrames(cam))
		return 0;
	return InterlockedCompareExchange((volatile LONG*)&cam->header->streaming, 0, 0) ? 1 : 0;
}

// One picture: width x height, BGR, top row first. 1 when it was handed over.
extern "C" int __cdecl KcCamSend(void* handle, const unsigned char* bgr, int width, int height)
{
	auto cam = (KcCam*)handle;
	if (!cam || !bgr || width <= 0 || height <= 0 || (UINT)width > KC_FRAME_MAX_W || (UINT)height > KC_FRAME_MAX_H)
		return 0;
	if (!OpenFrames(cam))
		return 0;
	auto h = cam->header;
	// sequence lock: odd while writing, even when the frame is complete (|1 also mends an odd value left by a crash)
	InterlockedOr64((volatile LONG64*)&h->seq, 1);
	h->width = (uint32_t)width;
	h->height = (uint32_t)height;
	memcpy(h + 1, bgr, (size_t)width * height * 3);
	MemoryBarrier();
	InterlockedIncrement64((volatile LONG64*)&h->seq);
	return 1;
}

extern "C" void __cdecl KcCamDelete(void* handle)
{
	if (handle)
		Release((KcCam*)handle);
}
