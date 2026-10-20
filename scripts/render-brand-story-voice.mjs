import {writeFile} from 'node:fs/promises';
import {KokoroTTS} from 'kokoro-js';
import {StyleTextToSpeech2Model,AutoTokenizer} from '@huggingface/transformers';
const modelId='onnx-community/Kokoro-82M-v1.0-ONNX';
const [model,tokenizer]=await Promise.all([
  StyleTextToSpeech2Model.from_pretrained(modelId,{dtype:'q8',device:'cpu',session_options:{intraOpNumThreads:2,interOpNumThreads:1}}),
  AutoTokenizer.from_pretrained(modelId),
]);
const tts=new KokoroTTS(model,tokenizer);
const audio=await tts.generate('We did this last year.',{voice:'af_nicole',speed:.91});
await writeFile(process.argv[2],Buffer.from(audio.toWav()));
console.log('Linda voice rendered with her approved af_nicole casting.');
