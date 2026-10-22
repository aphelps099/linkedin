import express from 'express';

// Keep query recipes intact. Browsers retain the incoming fragment on redirects.
export function createOptimizerRedirects(){
  const router=express.Router();
  router.get(['/lessons','/lessons/','/lessons/index.html','/optimizer/','/optimizer/index.html'],(req,res,next)=>{
    // Express is not strict about trailing slashes; the canonical URL must pass.
    if(req.path==='/optimizer')return next();
    const query=req.originalUrl.includes('?')?req.originalUrl.slice(req.originalUrl.indexOf('?')):'';
    res.redirect(301,`/optimizer${query}`);
  });
  return router;
}

export function optimizerPreview(){
  const configure=server=>{
    const app=express();
    app.use(createOptimizerRedirects());
    server.middlewares.use(app);
    server.middlewares.use((req,_res,next)=>{
      if(req.url?.split('?')[0]==='/optimizer')req.url=req.url.replace('/optimizer','/optimizer/index.html');
      next();
    });
  };
  return {name:'optimizer-canonical-route',configureServer:configure,configurePreviewServer:configure};
}
