// The approved female voice, running on our CPU; no external speech API.
let modelPromise;
export async function localAnnouncer(text){
  if(!modelPromise){
    modelPromise=Promise.all([import('kokoro-js'),import('@huggingface/transformers')]).then(async([{KokoroTTS},{StyleTextToSpeech2Model,AutoTokenizer}])=>{
      const id='onnx-community/Kokoro-82M-v1.0-ONNX';
      // Keep the same model and voice while bounding server CPU use. Disable
      // idle thread spinning so a loaded model does not burn CPU between songs.
      const [model,tokenizer]=await Promise.all([
        StyleTextToSpeech2Model.from_pretrained(id,{dtype:'q8',device:'cpu',session_options:{intraOpNumThreads:2,interOpNumThreads:1,extra:{session:{intra_op:{allow_spinning:'0'},inter_op:{allow_spinning:'0'}}}}}),
        AutoTokenizer.from_pretrained(id),
      ]);
      return new KokoroTTS(model,tokenizer);
    });
    modelPromise.catch(()=>{modelPromise=undefined;});
  }
  const model=await modelPromise;
  const audio=await model.generate(text,{voice:'af_heart',speed:.97});
  return Buffer.from(audio.toWav());
}
