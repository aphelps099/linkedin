// Course progress stays on this device. Keep the v1 key for existing learners.
const KEY='lb_program_v1';
const IDS=['hook','inflation','vocabulary','shape','single'];
const empty=()=>({userName:'',title:'',currentChapter:0,completedChapters:[],bestScore:0,posts:{}});
export function loadProgress(){
  try{
    const raw=JSON.parse(localStorage.getItem(KEY));
    if(raw && typeof raw==='object') return {
      userName:typeof raw.userName==='string' ? raw.userName : '',
      title:typeof raw.title==='string' ? raw.title : '',
      currentChapter:Number.isInteger(raw.currentChapter) ? Math.max(0,Math.min(4,raw.currentChapter)) : 0,
      completedChapters:[...new Set(Array.isArray(raw.completedChapters) ? raw.completedChapters.filter(id=>IDS.includes(id)) : [])],
      bestScore:typeof raw.bestScore==='number' ? raw.bestScore : 0,
      posts:raw.posts && typeof raw.posts==='object' && !Array.isArray(raw.posts) ? raw.posts : {},
    };
  }catch{ /* Private mode, unavailable storage, or an old malformed value. */ }
  return empty();
}
export function saveProgress(patch,previous=loadProgress()){
  const next={...previous,...patch};
  try{localStorage.setItem(KEY,JSON.stringify(next));}catch{ /* In-memory progress still works. */ }
  return next;
}
export function resetProgress(){try{localStorage.removeItem(KEY);}catch{ /* Storage unavailable. */ }}
