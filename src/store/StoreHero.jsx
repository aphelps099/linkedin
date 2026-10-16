import React from 'react';

export function StoreHero(){
  return <section className="shop-hero" aria-labelledby="shop-title">
    <div className="shop-hero-art">
      <picture>
        <source media="(max-width: 760px)" srcSet="../store/look-serious-circle-back-mobile.webp" width="1254" height="1254"/>
        <img className="shop-hero-photo" src="../store/look-serious-circle-back-hero.webp" width="1650" height="953" fetchPriority="high" alt="Five models in a sunlit parking garage wearing the LinkedIn Beats Look Serious collection: SERIOUS. tees, stacked CIRCLE BACK on the kneeling model’s navy shirt, and stacked OUT OF OFFICE on blue and pink tops."/>
      </picture>
      <h1 id="shop-title" className="shop-hero-lockup"><img src="../store/wordmark-white-pulse.svg" width="1087" height="104" alt="LinkedIn Beats"/><span>Store</span></h1>
    </div>
  </section>;
}
