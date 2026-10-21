// Kingdom Connect - the FrameCast camera on Windows 11 (Media Foundation).
// The picture travels from the Kingdom Connect app to the camera through one block of shared memory.
//
// The camera's media source runs inside Windows' Frame Server service (session 0), so the block lives in the
// Global namespace. Only a service may create a Global object, so the media source creates it (with access for
// the signed-in user) when an app starts using the camera; the Kingdom Connect app opens it and writes frames.
// "Connected" for the app = the block exists and the camera is streaming.
//
// Frames are written with a sequence lock: seq is odd while a frame is being written and even when it is complete,
// so the reader never shows half of one frame and half of the next.
#pragma once
#include <stdint.h>

#define KC_FRAME_NAME L"Global\\KingdomConnectCamera.Frame"
#define KC_FRAME_MAGIC 0x4B43464Du  // "KCFM"
#define KC_FRAME_VERSION 1u
#define KC_FRAME_MAX_W 1920u
#define KC_FRAME_MAX_H 1080u

#pragma pack(push, 8)
struct KcFrameHeader
{
	uint32_t magic;            // KC_FRAME_MAGIC
	uint32_t version;          // KC_FRAME_VERSION
	uint32_t width;            // of the frame in the block (written by the app)
	uint32_t height;
	volatile int64_t seq;      // sequence lock (see above); 0 = no frame yet
	volatile int32_t streaming;// 1 while an app is receiving the camera (written by the media source)
	uint32_t reserved[9];
	// then width * height * 3 bytes, BGR, top row first (the same layout the softcam camera takes)
};
#pragma pack(pop)

static_assert(sizeof(KcFrameHeader) == 64, "KcFrameHeader must stay 64 bytes");

#define KC_FRAME_BYTES ((uint64_t)sizeof(KcFrameHeader) + (uint64_t)KC_FRAME_MAX_W * KC_FRAME_MAX_H * 3)
