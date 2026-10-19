"""Offline eSpeak NG formant synthesis; no voice service or speaker imitation.

Uses the system library or `pip install espeakng-loader==0.2.4` in a user runtime.
API: https://github.com/espeak-ng/espeak-ng/blob/master/src/include/espeak-ng/speak_lib.h
"""
import ctypes as C
from ctypes.util import find_library
from pathlib import Path
import numpy as np

class RetroSpeech:
    def __init__(self):
        path=find_library('espeak-ng');data=None
        if not path:
            from espeakng_loader import get_library_path,get_data_path
            path=get_library_path();data=str(Path(get_data_path()).parent).encode()
        self.lib=C.CDLL(path)
        self.lib.espeak_Initialize.argtypes=[C.c_int,C.c_int,C.c_char_p,C.c_int]
        self.lib.espeak_Initialize.restype=C.c_int
        self.sample_rate=self.lib.espeak_Initialize(2,0,data,0x8000)
        if self.sample_rate<=0:raise RuntimeError('Could not initialize eSpeak NG')
        self.lib.espeak_SetVoiceByName.argtypes=[C.c_char_p]
        self.lib.espeak_SetParameter.argtypes=[C.c_int,C.c_int,C.c_int]
        self.lib.espeak_Synth.argtypes=[C.c_void_p,C.c_size_t,C.c_uint,C.c_int,C.c_uint,C.c_uint,C.c_void_p,C.c_void_p]
        self.lib.espeak_Info.argtypes=[C.c_void_p];self.lib.espeak_Info.restype=C.c_char_p
        self.version=self.lib.espeak_Info(None).decode()
        callback=C.CFUNCTYPE(C.c_int,C.POINTER(C.c_short),C.c_int,C.c_void_p)
        def capture(samples,count,events):
            if samples and count:self.chunks.append(C.string_at(samples,count*2))
            return 0
        self.callback=callback(capture)
        self.lib.espeak_SetSynthCallback.argtypes=[callback]
        self.lib.espeak_SetSynthCallback(self.callback)
        self.chunks=[]

    def synthesize(self,text,voice='en-us',rate=154,pitch=35,pitch_range=4):
        if self.lib.espeak_SetVoiceByName(voice.encode())!=0:raise ValueError(f'Voice unavailable: {voice}')
        for parameter,value in [(1,rate),(2,100),(3,pitch),(4,pitch_range)]:
            if self.lib.espeak_SetParameter(parameter,value,0)!=0:raise ValueError('Voice parameter rejected')
        self.chunks=[];buffer=C.create_string_buffer(text.encode('utf8'))
        if self.lib.espeak_Synth(buffer,len(buffer),0,1,0,1,None,None)!=0:raise RuntimeError('Speech synthesis failed')
        audio=np.frombuffer(b''.join(self.chunks),dtype='<i2').astype(float)/32768
        if len(audio)<100 or not np.isfinite(audio).all():raise RuntimeError('Empty or invalid speech')
        return self.sample_rate,audio
