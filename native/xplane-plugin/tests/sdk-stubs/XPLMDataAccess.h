#pragma once
typedef void* XPLMDataRef;
enum { xplmType_Int=1, xplmType_Float=2, xplmType_Double=4, xplmType_FloatArray=8, xplmType_IntArray=16, xplmType_Data=32 };
XPLMDataRef XPLMFindDataRef(const char*);
int XPLMGetDataRefTypes(XPLMDataRef);
int XPLMCanWriteDataRef(XPLMDataRef);
int XPLMGetDatai(XPLMDataRef);
void XPLMSetDatai(XPLMDataRef,int);
float XPLMGetDataf(XPLMDataRef);
void XPLMSetDataf(XPLMDataRef,float);
double XPLMGetDatad(XPLMDataRef);
int XPLMGetDatavf(XPLMDataRef,float*,int,int);
int XPLMGetDatavi(XPLMDataRef,int*,int,int);

int XPLMGetDatab(XPLMDataRef,void*,int,int);
