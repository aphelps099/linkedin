import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {KokoroTTS} from 'kokoro-js';
import {StyleTextToSpeech2Model,AutoTokenizer,env} from '@huggingface/transformers';
import {characters} from '../../../../src/meeting-room/voice-bank/characters.js';
const here=dirname(fileURLToPath(import.meta.url));
const out=resolve(process.argv[2]);
await mkdir(out,{recursive:true});
env.allowRemoteModels=false;
const modelId='onnx-community/Kokoro-82M-v1.0-ONNX';
const [model,tokenizer]=await Promise.all([
  StyleTextToSpeech2Model.from_pretrained(modelId,{dtype:'q8',device:'cpu',session_options:{intraOpNumThreads:2,interOpNumThreads:1,extra:{session:{intra_op:{allow_spinning:'0'},inter_op:{allow_spinning:'0'}}}}}),
  AutoTokenizer.from_pretrained(modelId),
]);
const tts=new KokoroTTS(model,tokenizer);
const script=JSON.parse(await readFile(process.argv[3]?resolve(process.argv[3]):resolve(here,'script.json'),'utf8'));
for(const [i,line] of script.lines.entries()){
  if(line.who==='synergy')continue;
  const p=characters[line.who];
  const audio=await tts.generate(line.text,{voice:p.voice,speed:p.speed});
  await writeFile(resolve(out,`voice-${i}.wav`),Buffer.from(audio.toWav()));
  console.log(`${i}: ${line.who} — ${line.text}`);
}
const hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
await writeFile(resolve(out,'voice-provenance.json'),JSON.stringify({characters,modelId,dtype:'q8',modelSha256:await hash(resolve(env.cacheDir,modelId,'onnx/model_quantized.onnx')),newTakes:'Generated with existing cast settings; awaiting listening review'},null,2));
