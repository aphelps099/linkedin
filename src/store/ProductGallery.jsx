import React, {useState} from 'react';
import {ProductVisual, isDesignPreview} from './ProductVisual.jsx';

export function ProductGallery({product}){
  const [selected,setSelected]=useState(0);
  const images=product.images || [];
  const current=images[selected];
  return <div className="shop-detail-gallery">
    <div className={`shop-detail-image${current?.kind==='model'?' is-on-model':''}`}>
      <ProductVisual product={product} media={current} eager/>
      {isDesignPreview(product)&&<span className="shop-preview-label">DESIGN PREVIEW</span>}
    </div>
    {images.length>1&&<div className="shop-gallery-thumbnails" role="group" aria-label={`${product.name} views`}>
      {images.map((media,index)=><button key={media.img || media.layout} type="button" className={selected===index?'is-selected':''} aria-pressed={selected===index} aria-label={`View ${index+1}: ${media.label || 'product design'}`} onClick={()=>setSelected(index)}>
        <ProductVisual product={product} media={media}/>
      </button>)}
    </div>}
    {current?.label&&<p className="shop-gallery-caption" aria-live="polite">{current.label}</p>}
  </div>;
}
