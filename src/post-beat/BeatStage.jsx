import React,{useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
export function BeatStage({children,onClose}){
 const dialog=useRef(null);
 useEffect(()=>{const el=dialog.current,focused=document.activeElement,overflow=document.body.style.overflow;el.showModal();document.body.style.overflow='hidden';return()=>{el.close();document.body.style.overflow=overflow;focused?.focus({preventScroll:true});};},[]);
 return createPortal(<dialog ref={dialog} className="pb-stage-dialog pb-studio-dialog" aria-label="Singalong player" onCancel={onClose} onClick={e=>{if(e.target===dialog.current)onClose();}}><div className="pb-stage-sheet"><header><span>Your words. Centre stage.</span><button type="button" onClick={onClose} autoFocus aria-label="Close singalong player"><X size={24}/></button></header>{children}</div></dialog>,document.body);
}
