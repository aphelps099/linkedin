// A quiet gallery arrival on one continuous, stationary pegboard.
const field = document.querySelector('#sharedPegField');
const gallery = document.querySelector('#humbled');
if (field && gallery) {
  gallery.classList.add('gallery-reveal-ready');
  gallery.querySelectorAll('.film-card').forEach((card,i)=>card.style.setProperty('--card-arrival',`${100+i*85}ms`));
  let queued=false;
  function update(){
    queued=false;
    const rect=gallery.getBoundingClientRect();
    const entering=rect.top < innerHeight*.72 && rect.bottom>0;
    field.classList.toggle('gallery-focus',entering);
    if(entering)gallery.classList.add('has-arrived');
    else if(rect.top>innerHeight*.95)gallery.classList.remove('has-arrived');
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(update)}}
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  new ResizeObserver(schedule).observe(field);
  update();
}
