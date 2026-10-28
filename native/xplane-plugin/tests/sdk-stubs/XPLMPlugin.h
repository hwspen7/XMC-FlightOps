#pragma once
#define PLUGIN_API extern "C"
typedef int XPLMPluginID;
XPLMPluginID XPLMGetMyID();
void XPLMGetPluginInfo(XPLMPluginID,char*,char*,char*,char*);
