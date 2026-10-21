(() => {
  const root = document.getElementById('lb-palette-proof');
  const rail = root.querySelector('.proof-rail');
  const cards = [...root.querySelectorAll('.proof-card')];
  const dots = [...root.querySelectorAll('[data-index]')];
  const previous = root.querySelector('.proof-prev');
  const next = root.querySelector('.proof-next');
  let active = 0, frame;
  function show(index) {
    index = Math.max(0, Math.min(cards.length - 1, index));
    const left = cards[index].getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft - parseFloat(getComputedStyle(rail).paddingLeft);
    rail.scrollTo({left,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  function update() {
    const edge = rail.getBoundingClientRect().left + parseFloat(getComputedStyle(rail).paddingLeft);
    active = cards.reduce((best,card,i) => Math.abs(card.getBoundingClientRect().left - edge) < Math.abs(cards[best].getBoundingClientRect().left - edge) ? i : best, 0);
    dots.forEach((dot,i) => i === active ? dot.setAttribute('aria-current','true') : dot.removeAttribute('aria-current'));
    previous.disabled = active === 0;
    next.disabled = active === cards.length - 1;
    root.querySelector('[role=status]').textContent = `Artwork ${active+1} of ${cards.length}`;
  }
  previous.addEventListener('click', () => show(active - 1));
  next.addEventListener('click', () => show(active + 1));
  dots.forEach((dot,i) => dot.addEventListener('click', () => show(i)));
  rail.addEventListener('scroll', () => {cancelAnimationFrame(frame);frame=requestAnimationFrame(update);}, {passive:true});
  update();
})();
