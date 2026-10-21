#pragma once
// Kingdom Connect: replaces VCamSample's FrameGenerator (which drew a test picture). This one shows the picture the
// Kingdom Connect app writes into shared memory (SharedFrame.h), as RGB32 or NV12, on the CPU.
// The public methods keep VCamSample's names, so MediaStream.cpp uses it unchanged.
#include <vector>
#include "SharedFrame.h"

class FrameGenerator
{
	UINT _width = 0;
	UINT _height = 0;
	HANDLE _mapping = nullptr;
	KcFrameHeader* _header = nullptr;
	std::vector<BYTE> _last;       // the last complete frame, BGR, _width x _height
	std::vector<BYTE> _scratch;    // where the next frame is copied before it is known to be complete
	int64_t _lastSeq = -1;

	HRESULT OpenShared();
	void CloseShared();
	bool CopyLatest();

public:
	FrameGenerator() = default;
	~FrameGenerator() { Stop(); CloseShared(); }
	FrameGenerator(const FrameGenerator&) = delete;
	FrameGenerator& operator=(const FrameGenerator&) = delete;

	// The picture is made on the CPU, so a Direct3D manager is accepted and not used.
	HRESULT SetD3DManager(IUnknown*, UINT, UINT) { return S_OK; }
	const bool HasD3DManager() const { return false; }

	// Called when the stream starts: sizes the picture and tells the app the camera is in use.
	HRESULT EnsureRenderTarget(UINT width, UINT height);

	// Called when the stream stops.
	void Stop();

	HRESULT Generate(IMFSample* sample, REFGUID format, IMFSample** outSample);
};
