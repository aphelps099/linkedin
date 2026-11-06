import {createHeroAllHands} from './hero-allhands.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const hero=$('#heroVideo'),radio=$('#radioAudio'),consoleEl=$('#missionConsole'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const hands=createHeroAllHands();
let mode='welcome',revision=0;
const picker=$('#heroModePicker'),modeToggle=$('#heroModeToggle');
const modeNames={welcome:'HERO FILM',onboarding:'FILM',audio:'ALL HANDS',speech:'THE LADY',make:'START A BEAT'};
function closePicker(focus=false){picker.hidden=true;modeToggle.setAttribute('aria-expanded','false');if(focus)modeToggle.focus({preventScroll:true})}
modeToggle.onclick=()=>{const open=picker.hidden;if(open&&$('#home').getBoundingClientRect().top<0)$('#home').scrollIntoView({block:'start',behavior:'instant'});picker.hidden=!open;modeToggle.setAttribute('aria-expanded',String(open));if(open)picker.querySelector('button[aria-pressed=true]')?.focus({preventScroll:true})};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.hero-mode-control'))closePicker()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!picker.hidden){closePicker(true);e.stopPropagation()}});
$('#pausePixelFilm').onclick=()=>{if(hero.paused)hero.play().catch(refresh);else hero.pause();refresh()};
const names={welcome:'SYNERGY / HERO FILM',onboarding:'FILM / WELCOME TO THE OFFICE',audio:'RADIO / ALL HANDS',speech:'THE LADY / ORIGINAL TAKES',make:'YOUR POST / YOUR PERFORMANCE'};
function time(n){return Number.isFinite(n)?String(Math.floor(n/60)).padStart(2,'0')+':'+String(Math.floor(n%60)).padStart(2,'0'):'--:--'}
function refresh(){const h=['audio','speech'].includes(mode),st=h?hands.status():{paused:hero.paused,muted:hero.muted,position:hero.currentTime,duration:hero.duration};
 $$('button[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
 $('#missionIndicator').textContent=st.error?st.error:st.loading?'ALL HANDS / WARMING UP':st.custom&&mode==='audio'?'YOUR POST / INSTRUMENTAL':names[mode];
 $('#heroPause').textContent=st.loading?'Loading…':st.paused?'Play':'Pause';$('#heroPause').disabled=!!st.loading;$('#heroPause').setAttribute('aria-label',(st.paused?'Play ':'Pause ')+(mode==='onboarding'?'film':mode));$('#heroPause').setAttribute('aria-pressed',String(st.paused));
 $('#heroSound').textContent=st.muted?'Unmute':'Mute';$('#heroSound').setAttribute('aria-label',st.muted?'Turn sound on':'Mute sound');$('#heroSound').setAttribute('aria-pressed',String(!st.muted));
 const prog=st.duration?st.position/st.duration:0;$('#viewerSeek').value=String(prog*100);$('#viewerSeek').disabled=mode!=='onboarding'||!Number.isFinite(st.duration);$('#viewerSeek').setAttribute('aria-label',mode==='onboarding'?'Film position':'Performance progress');$('#viewerClock').textContent=time(st.position)+' / '+time(st.duration);$$('.viewer-segments i').forEach((el,i)=>el.classList.toggle('lit',i/32<prog));
 consoleEl.classList.toggle('is-paused',!!st.paused);$('#heroModeName').textContent=modeNames[mode];$('#pausePixelFilm').hidden=mode!=='welcome';$('#pausePixelFilm').textContent=hero.paused?'Play picture':'Pause picture';$$('[data-tools]').forEach(el=>el.hidden=el.dataset.tools!==(mode==='audio'?'audioDisplay':mode==='speech'?'speechDisplay':''));modeToggle.setAttribute('aria-label','Change mode. Current: '+modeNames[mode]);
}
function setMode(next,{sound=false,post=null}={}){revision++;if(revision>1)$('#home').scrollIntoView({block:'start',behavior:'instant'});hands.stop();hero.pause();radio.pause();mode=next;consoleEl.dataset.mode=mode;$('#home').dataset.heroMode=mode;closePicker();
 hero.hidden=!['welcome','onboarding'].includes(mode);$('#idleDisplay').hidden=true;$('#audioDisplay').hidden=mode!=='audio';$('#speechDisplay').hidden=mode!=='speech';$('#makeDisplay').hidden=mode!=='make';
 document.dispatchEvent(new CustomEvent('hero-mode',{detail:{mode}}));
 if(['welcome','onboarding'].includes(mode)){hero.muted=mode==='welcome'||!sound;if(!reduced||mode==='onboarding')hero.play().catch(refresh)}else if(mode==='audio'||mode==='speech')hands.enter(mode,post);else $('#makePost').focus({preventScroll:true});refresh();
}
$$('button[data-mode]').forEach(b=>b.onclick=()=>{setMode(b.dataset.mode,{sound:b.dataset.mode==='onboarding'});if(b.dataset.mode!=='make')modeToggle.focus({preventScroll:true})});
$('#playSoundtrack').onclick=()=>setMode('audio');$('#watchHeroFilm').onclick=()=>setMode('onboarding',{sound:true});
$('#replayOpening').onclick=()=>{closeExpanded();document.querySelector('#home').scrollIntoView({block:'start',behavior:'instant'});setMode('welcome');document.dispatchEvent(new Event('hero-replay'))};
$('#makeDisplay').onsubmit=e=>{e.preventDefault();const post=$('#makePost').value.trim();if(post)setMode('audio',{post})};
$('#heroPause').onclick=()=>{if(['audio','speech'].includes(mode))hands.toggle();else if(hero.paused)hero.play().catch(refresh);else hero.pause();refresh()};
$('#heroSound').onclick=()=>{if(['audio','speech'].includes(mode))hands.toggleMute();else hero.muted=!hero.muted;refresh()};
$('#viewerSeek').oninput=e=>{if(mode==='onboarding'&&Number.isFinite(hero.duration))hero.currentTime=hero.duration*Number(e.target.value)/100;refresh()};
['play','pause','timeupdate','durationchange','volumechange','error'].forEach(ev=>hero.addEventListener(ev,refresh));
hero.addEventListener('play',()=>{if(!['welcome','onboarding'].includes(mode))hero.pause()});
radio.addEventListener('play',()=>{hands.stop();hero.pause()});document.addEventListener('allhands-state',refresh);
setInterval(()=>{if(!document.hidden&&['audio','speech'].includes(mode))refresh()},200);
const viewerHome=document.createComment('Viewer position');consoleEl.before(viewerHome);
function expandUI(){const yes=consoleEl.classList.contains('is-expanded');$('#viewerExpand').textContent=yes?'×':'⤢';$('#viewerExpand').setAttribute('aria-label',yes?'Exit expanded viewer':'Expand viewer');$('#viewerExpand').setAttribute('aria-pressed',String(yes));hands.resize()}
function closeExpanded(){if(!consoleEl.classList.contains('is-expanded'))return;viewerHome.after(consoleEl);consoleEl.classList.remove('is-expanded');document.body.style.overflow='';expandUI()}
$('#viewerExpand').onclick=()=>{if(consoleEl.classList.contains('is-expanded'))return closeExpanded();document.body.append(consoleEl);consoleEl.classList.add('is-expanded');document.body.style.overflow='hidden';expandUI()};document.addEventListener('keydown',e=>{if(e.key==='Escape')closeExpanded()});
$$('.film-open').forEach(b=>b.addEventListener('click',()=>{hands.stop();hero.pause()}));
document.addEventListener('visibilitychange',()=>{if(document.hidden){hero.pause();radio.pause()}else if(mode==='welcome'&&!reduced)hero.play().catch(refresh);refresh()});
setMode('welcome');
