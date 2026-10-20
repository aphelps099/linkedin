// Program progress — localStorage only. No accounts, no telemetry.
const KEY = 'lb_program_v1';

const EMPTY = { userName: '', title: '', currentChapter: 0, completedChapters: [], bestScore: 0, posts: {} };

export function loadProgress(){
  if(typeof window === 'undefined') return {...EMPTY};
  try{
    const raw = localStorage.getItem(KEY);
    if(raw) return {...EMPTY, ...JSON.parse(raw)};
  }catch{ /* private mode, blocked storage */ }
  return {...EMPTY};
}

export function saveProgress(patch){
  const next = {...loadProgress(), ...patch};
  try{ localStorage.setItem(KEY, JSON.stringify(next)); }catch{ /* ignore */ }
  return next;
}

export function resetProgress(){
  try{ localStorage.removeItem(KEY); }catch{ /* ignore */ }
}
