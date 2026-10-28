#pragma once
typedef void* XPLMCommandRef;
XPLMCommandRef XPLMFindCommand(const char*);
void XPLMCommandOnce(XPLMCommandRef);
void XPLMDebugString(const char*);
