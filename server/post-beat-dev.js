import express from 'express';
import {createPostBeatService} from './post-beat-service.js';
export function postBeatApi(){
  return {name:'post-beat-voices',configureServer(server){
    const app=express(),service=createPostBeatService();
    app.use(express.json({limit:'10kb'}));
    app.use('/api/post-beat/voices',service.router);
    server.middlewares.use(app);
  }};
}
