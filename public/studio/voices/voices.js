const status=document.querySelector('#status');
try {
  const responses=await Promise.all([fetch('./catalog.json',{cache:'no-cache'}),fetch('./recordings.json',{cache:'no-cache'})]);
  if(responses.some(response=>!response.ok)) throw new Error('The casting files could not be loaded. Please refresh.');
  const [catalog,recordings]=await Promise.all(responses.map(response=>response.json()));
  const container=document.querySelector('#cast');
  let number=0;
  for(const [id,profile] of Object.entries(catalog.characters)) {
    if(profile.kind!=='human') continue;
    const audition=recordings.auditions[id];
    if(!audition) throw new Error(`The ${profile.name} audition is unavailable.`);
    const card=document.createElement('article');
    card.className='card';
    // Markup is fixed; all catalog text is assigned through textContent.
    card.innerHTML='<div class="portrait"><img loading="lazy"><span class="number"></span><span class="speaking" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></div><div class="copy"><h3></h3><p class="direction"></p><audio controls preload="none"></audio><details><summary>Read the audition</summary><ol></ol></details></div>';
    const img=card.querySelector('img');img.src=`/studio/season/posters/${profile.poster}`;img.alt=profile.name;
    card.querySelector('.number').textContent=`VOICE ${String(++number).padStart(2,'0')}`;
    card.querySelector('h3').textContent=profile.name;
    card.querySelector('.direction').textContent=profile.direction;
    const audio=card.querySelector('audio');audio.src=`./${audition.file}?v=${audition.sha256}`;audio.setAttribute('aria-label',`Listen to ${profile.name}`);
    audio.addEventListener('play',()=>{
      for(const other of document.querySelectorAll('audio')) if(other!==audio) other.pause();
      card.classList.add('playing');status.textContent=`Playing ${profile.name}.`;
    });
    for(const event of ['pause','ended']) audio.addEventListener(event,()=>{card.classList.remove('playing');if(![...document.querySelectorAll('audio')].some(a=>!a.paused))status.textContent='';});
    audio.addEventListener('error',()=>{status.classList.remove('sr-only');status.textContent=`This audition could not load. Please refresh and try ${profile.name} again.`;});
    for(const lineId of audition.lines){const item=document.createElement('li');item.textContent=catalog.lines.find(line=>line.id===lineId).text;card.querySelector('ol').append(item);}
    container.append(card);
  }
  document.querySelector('#line-count').textContent=`${catalog.lines.length} indexed lines. ${Object.keys(catalog.meetings).length} connected scripts.`;
  status.textContent='';
  status.classList.add('sr-only');
} catch(error) {status.textContent=error.message;}
