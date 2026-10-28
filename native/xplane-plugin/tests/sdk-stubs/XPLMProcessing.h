#pragma once
typedef float (*XPLMFlightLoop_f)(float,float,int,void*);
void XPLMRegisterFlightLoopCallback(XPLMFlightLoop_f,float,void*);
void XPLMUnregisterFlightLoopCallback(XPLMFlightLoop_f,void*);
