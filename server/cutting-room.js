import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// The catalog is unlisted, not access-controlled. Writes require a separate
// deployment secret; it is never bundled into the browser or catalog data.
export function createCuttingRoomRouter() {
  const router = express.Router();
  const env = process.env;
  let client;
  function storage() {
    if (!env.CATALOG_S3_BUCKET || !env.CATALOG_S3_ENDPOINT) throw new Error('Media storage unavailable');
    return client ||= new S3Client({
      endpoint:env.CATALOG_S3_ENDPOINT, region:env.CATALOG_S3_REGION || 'auto',
      credentials:{accessKeyId:env.CATALOG_S3_ACCESS_KEY,secretAccessKey:env.CATALOG_S3_SECRET_KEY},
      requestChecksumCalculation:'WHEN_REQUIRED', responseChecksumValidation:'WHEN_REQUIRED',
    });
  }
  const validKey = key => /^[a-z0-9][a-z0-9-]{1,110}\.(mp4|jpg|webp)$/.test(key);
  router.use((_req,res,next)=>{res.set('X-Robots-Tag','noindex, nofollow, noarchive');next();});
  router.get('/media/:key',async(req,res)=>{
    if(!validKey(req.params.key)) return res.sendStatus(404);
    try {
      const url=await getSignedUrl(storage(),new GetObjectCommand({
        Bucket:env.CATALOG_S3_BUCKET,Key:`media/${req.params.key}`,
        ...(req.query.download==='1'?{ResponseContentDisposition:`attachment; filename="${req.params.key}"`}:{}),
      }),{expiresIn:3600});
      res.set('Cache-Control','private, max-age=300').redirect(302,url);
    } catch {res.status(503).json({error:'This clip is temporarily unavailable. Please try again.'});}
  });
  router.put('/media/:key',async(req,res)=>{
    const expected=Buffer.from(env.CATALOG_UPLOAD_TOKEN || '');
    const supplied=Buffer.from((req.get('authorization') || '').replace(/^Bearer /,''));
    if(!expected.length || expected.length!==supplied.length || !timingSafeEqual(expected,supplied)) return res.sendStatus(401);
    if(!validKey(req.params.key)) return res.status(400).json({error:'Invalid media name'});
    const length=Number(req.get('content-length'));
    if(!Number.isSafeInteger(length)||length<1||length>300*1024*1024) return res.sendStatus(413);
    try {
      const contentType=req.params.key.endsWith('.mp4')?'video/mp4':req.params.key.endsWith('.webp')?'image/webp':'image/jpeg';
      await storage().send(new PutObjectCommand({Bucket:env.CATALOG_S3_BUCKET,Key:`media/${req.params.key}`,Body:req,ContentLength:length,ContentType:contentType,CacheControl:'public, max-age=31536000, immutable'}));
      res.status(201).json({key:req.params.key,bytes:length});
    } catch(error) {console.error('catalog upload:',error.name);res.status(502).json({error:'Upload failed'});}
  });
  return router;
}
