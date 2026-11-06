(()=>{
const section=document.querySelector('.printer-section'),button=section.querySelector('.printer-pause'),paper=section.querySelector('.printed-post');
const examples=[['I made coffee.','Today, I transformed coffee beans into a catalyst for connection and growth.','One cup. Endless possibilities.'],['I went for a walk.','Today, I stepped outside my comfort zone. And, quite literally, outside the building.','Every step is a leadership opportunity.'],['I answered an email.','Thrilled to announce a new milestone in cross-functional communication. I hit reply.','One inbox. Unlimited impact.']];
let index=0,paused=false;
paper.addEventListener('animationiteration',event=>{if(event.target!==paper)return;index=(index+1)%examples.length;const [input,body,punchline]=examples[index];document.querySelector('#printerInput').textContent=input;document.querySelector('#printedBody').textContent=body;document.querySelector('#printedPunchline').textContent=punchline});
button.addEventListener('click',()=>{paused=!paused;section.classList.toggle('printer-paused',paused);button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'▶ Resume printer':'Ⅱ Pause printer'});
new IntersectionObserver(([entry])=>section.classList.toggle('printer-offscreen',!entry.isIntersecting),{threshold:.05}).observe(section);
})();