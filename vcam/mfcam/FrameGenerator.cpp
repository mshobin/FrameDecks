// Kingdom Connect: the picture of the KingdomConnect camera on Windows 11 (see FrameGenerator.h and SharedFrame.h).
#include "pch.h"
#include <sddl.h>
#include "Undocumented.h"
#include "Tools.h"
#include "EnumNames.h"
#include "MFTools.h"
#include "FrameGenerator.h"

#pragma comment(lib, "advapi32")

// Full access for the system, the Frame Server services and administrators; read and write for the signed-in user
// (the Kingdom Connect app). Nobody else can see the picture.
static const wchar_t* FRAME_SDDL = L"D:(A;;GA;;;SY)(A;;GA;;;LS)(A;;GA;;;BA)(A;;GRGW;;;IU)";

// The colour shown before the app sends its first frame: the app's navy (#0B1222).
static const BYTE IDLE_B = 0x22, IDLE_G = 0x12, IDLE_R = 0x0B;

HRESULT FrameGenerator::OpenShared()
{
	if (_header)
		return S_OK;

	PSECURITY_DESCRIPTOR sd = nullptr;
	RETURN_IF_WIN32_BOOL_FALSE(ConvertStringSecurityDescriptorToSecurityDescriptorW(FRAME_SDDL, SDDL_REVISION_1, &sd, nullptr));
	SECURITY_ATTRIBUTES sa{ sizeof(sa), sd, FALSE };
	auto size = KC_FRAME_BYTES;
	// Frame Server may create Global objects; an app that loads this DLL (and may not) opens the existing block instead
	_mapping = CreateFileMappingW(INVALID_HANDLE_VALUE, &sa, PAGE_READWRITE, (DWORD)(size >> 32), (DWORD)size, KC_FRAME_NAME);
	LocalFree(sd);
	if (!_mapping)
		_mapping = OpenFileMappingW(FILE_MAP_READ | FILE_MAP_WRITE, FALSE, KC_FRAME_NAME);
	RETURN_LAST_ERROR_IF_NULL(_mapping);

	_header = (KcFrameHeader*)MapViewOfFile(_mapping, FILE_MAP_READ | FILE_MAP_WRITE, 0, 0, 0);
	if (!_header)
	{
		auto hr = HRESULT_FROM_WIN32(GetLastError());
		CloseHandle(_mapping);
		_mapping = nullptr;
		RETURN_HR(hr);
	}
	if (_header->magic != KC_FRAME_MAGIC)
	{
		// a new block: the app has not written yet
		_header->version = KC_FRAME_VERSION;
		_header->width = 0;
		_header->height = 0;
		_header->seq = 0;
		_header->magic = KC_FRAME_MAGIC;
	}
	WINTRACE(L"KingdomConnect frame block open");
	return S_OK;
}

void FrameGenerator::CloseShared()
{
	if (_header)
	{
		UnmapViewOfFile(_header);
		_header = nullptr;
	}
	if (_mapping)
	{
		CloseHandle(_mapping);
		_mapping = nullptr;
	}
}

HRESULT FrameGenerator::EnsureRenderTarget(UINT width, UINT height)
{
	RETURN_HR_IF(E_INVALIDARG, !width || !height || width > KC_FRAME_MAX_W || height > KC_FRAME_MAX_H);
	_width = width;
	_height = height;
	_lastSeq = -1;
	_last.assign((size_t)width * height * 3, 0);
	for (size_t i = 0; i < _last.size(); i += 3)
	{
		_last[i] = IDLE_B;
		_last[i + 1] = IDLE_G;
		_last[i + 2] = IDLE_R;
	}
	LOG_IF_FAILED(OpenShared());   // without the block the camera still streams (the idle colour)
	if (_header)
		InterlockedExchange((volatile LONG*)&_header->streaming, 1);
	return S_OK;
}

void FrameGenerator::Stop()
{
	if (_header)
		InterlockedExchange((volatile LONG*)&_header->streaming, 0);
}

// Copies the newest complete frame from the app into _last (scaled to the stream size). False when there is no new one.
bool FrameGenerator::CopyLatest()
{
	if (!_header && FAILED(OpenShared()))
		return false;
	auto h = _header;
	auto seq = InterlockedCompareExchange64((volatile LONG64*)&h->seq, 0, 0);
	if (seq <= 0 || (seq & 1) || seq == _lastSeq)
		return false;
	UINT sw = h->width, sh = h->height;
	if (!sw || !sh || sw > KC_FRAME_MAX_W || sh > KC_FRAME_MAX_H)
		return false;

	auto src = (const BYTE*)(h + 1);
	_scratch.resize(_last.size());
	auto dst = _scratch.data();
	if (sw == _width && sh == _height)
	{
		memcpy(dst, src, (size_t)sw * sh * 3);
	}
	else
	{
		// nearest-neighbour scaling (the app normally sends exactly the stream size)
		for (UINT y = 0; y < _height; y++)
		{
			auto row = src + (size_t)(y * sh / _height) * sw * 3;
			auto out = dst + (size_t)y * _width * 3;
			for (UINT x = 0; x < _width; x++)
			{
				auto p = row + (size_t)(x * sw / _width) * 3;
				out[0] = p[0];
				out[1] = p[1];
				out[2] = p[2];
				out += 3;
			}
		}
	}
	// the app started another frame while we copied: drop the copy (it may be half old, half new)
	MemoryBarrier();
	if (InterlockedCompareExchange64((volatile LONG64*)&h->seq, 0, 0) != seq)
		return false;
	_last.swap(_scratch);
	_lastSeq = seq;
	return true;
}

static inline BYTE Clip(int v) { return (BYTE)(v < 0 ? 0 : (v > 255 ? 255 : v)); }

// BT.601, limited range (what webcams send)
static void BgrToNv12(const BYTE* bgr, UINT width, UINT height, BYTE* y0, LONG pitch)
{
	auto uv0 = y0 + (size_t)pitch * height;
	for (UINT y = 0; y < height; y++)
	{
		auto in = bgr + (size_t)y * width * 3;
		auto out = y0 + (size_t)y * pitch;
		for (UINT x = 0; x < width; x++)
		{
			int b = in[0], g = in[1], r = in[2];
			out[x] = Clip(((66 * r + 129 * g + 25 * b + 128) >> 8) + 16);
			in += 3;
		}
	}
	for (UINT y = 0; y + 1 < height; y += 2)
	{
		auto in1 = bgr + (size_t)y * width * 3, in2 = in1 + (size_t)width * 3;
		auto out = uv0 + (size_t)(y / 2) * pitch;
		for (UINT x = 0; x + 1 < width; x += 2)
		{
			int b = (in1[0] + in1[3] + in2[0] + in2[3]) / 4;
			int g = (in1[1] + in1[4] + in2[1] + in2[4]) / 4;
			int r = (in1[2] + in1[5] + in2[2] + in2[5]) / 4;
			out[x] = Clip(((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128);
			out[x + 1] = Clip(((112 * r - 94 * g - 18 * b + 128) >> 8) + 128);
			in1 += 6;
			in2 += 6;
		}
	}
}

static void BgrToRgb32(const BYTE* bgr, UINT width, UINT height, BYTE* out0, LONG pitch)
{
	for (UINT y = 0; y < height; y++)
	{
		auto in = bgr + (size_t)y * width * 3;
		auto out = out0 + (LONG_PTR)y * pitch;
		for (UINT x = 0; x < width; x++)
		{
			out[0] = in[0];
			out[1] = in[1];
			out[2] = in[2];
			out[3] = 0xFF;
			in += 3;
			out += 4;
		}
	}
}

HRESULT FrameGenerator::Generate(IMFSample* sample, REFGUID format, IMFSample** outSample)
{
	RETURN_HR_IF_NULL(E_POINTER, sample);
	RETURN_HR_IF_NULL(E_POINTER, outSample);
	*outSample = nullptr;
	RETURN_HR_IF(E_UNEXPECTED, !_width || !_height);

	CopyLatest();   // when the app sent nothing new, the last picture is shown again

	wil::com_ptr_nothrow<IMFMediaBuffer> mediaBuffer;
	RETURN_IF_FAILED(sample->GetBufferByIndex(0, &mediaBuffer));
	wil::com_ptr_nothrow<IMF2DBuffer2> buffer2D;
	RETURN_IF_FAILED(mediaBuffer->QueryInterface(IID_PPV_ARGS(&buffer2D)));
	BYTE* scanline;
	LONG pitch;
	BYTE* start;
	DWORD length;
	RETURN_IF_FAILED(buffer2D->Lock2DSize(MF2DBuffer_LockFlags_Write, &scanline, &pitch, &start, &length));

	auto hr = S_OK;
	if (format == MFVideoFormat_NV12)
	{
		if ((uint64_t)pitch * _height * 3 / 2 > length || pitch < (LONG)_width)
			hr = E_UNEXPECTED;
		else
			BgrToNv12(_last.data(), _width, _height, scanline, pitch);
	}
	else
	{
		if ((uint64_t)(pitch < 0 ? -pitch : pitch) * _height > length || (pitch < 0 ? -pitch : pitch) < (LONG)_width * 4)
			hr = E_UNEXPECTED;
		else
			BgrToRgb32(_last.data(), _width, _height, scanline, pitch);
	}
	buffer2D->Unlock2D();
	RETURN_IF_FAILED(hr);

	sample->AddRef();
	*outSample = sample;
	return S_OK;
}
