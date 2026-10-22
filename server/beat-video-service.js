import express from 'express';
import {mkdir,writeFile,readFile,unlink,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

// Temporary video storage for LinkedIn OG video embeds
// Videos expire after 7 days and are capped at 100MB total storage

const VIDEO_DIR = process.env.BEAT_VIDEO_CACHE_DIR || '/data/beat-video-cache';
const MAX_VIDEO_SIZE = 10 * 1024 * 1024; // 10MB per video
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

class BeatVideoStore {
  constructor(dir) {
    this.dir = dir;
    this.ready = this.initialize();
    this.cleanupTimer = null;
  }

  async initialize() {
    try {
      await mkdir(this.dir, { recursive: true });
      await this.cleanup();
      this.scheduleCleanup();
    } catch (error) {
      console.error('[beat-video] Failed to initialize storage:', error);
    }
  }

  scheduleCleanup() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  videoId(recipe, coverId, artist = '') {
    const data = JSON.stringify({ chorus: recipe.chorus, cover: coverId, artist });
    return createHash('sha256').update(data).digest('hex').slice(0, 16);
  }

  videoPath(id) {
    return join(this.dir, `${id}.mp4`);
  }

  metaPath(id) {
    return join(this.dir, `${id}.json`);
  }

  async store(id, videoBuffer, metadata = {}) {
    await this.ready;

    if (videoBuffer.length > MAX_VIDEO_SIZE) {
      throw new Error(`Video exceeds ${MAX_VIDEO_SIZE / 1024 / 1024}MB limit`);
    }

    const meta = {
      ...metadata,
      uploadedAt: Date.now(),
      size: videoBuffer.length,
    };

    // Write atomically
    const tempVideo = `${this.videoPath(id)}.tmp`;
    const tempMeta = `${this.metaPath(id)}.tmp`;

    try {
      await writeFile(tempVideo, videoBuffer);
      await writeFile(tempMeta, JSON.stringify(meta, null, 2));
      await Promise.all([
        writeFile(this.videoPath(id), videoBuffer),
        writeFile(this.metaPath(id), JSON.stringify(meta, null, 2))
      ]);
      await Promise.all([unlink(tempVideo).catch(() => {}), unlink(tempMeta).catch(() => {})]);
    } catch (error) {
      await Promise.all([unlink(tempVideo).catch(() => {}), unlink(tempMeta).catch(() => {})]);
      throw error;
    }

    await this.enforceSizeLimit();
    return id;
  }

  async retrieve(id) {
    await this.ready;
    try {
      const [video, metaStr] = await Promise.all([
        readFile(this.videoPath(id)),
        readFile(this.metaPath(id), 'utf8').catch(() => '{}')
      ]);
      const meta = JSON.parse(metaStr);

      // Check expiry
      if (meta.uploadedAt && Date.now() - meta.uploadedAt > MAX_AGE_MS) {
        await this.delete(id);
        return null;
      }

      return { video, meta };
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(id) {
    await Promise.all([
      unlink(this.videoPath(id)).catch(() => {}),
      unlink(this.metaPath(id)).catch(() => {})
    ]);
  }

  async cleanup() {
    try {
      const files = await readdir(this.dir);
      const now = Date.now();

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const id = file.replace('.json', '');
        const metaPath = this.metaPath(id);

        try {
          const metaStr = await readFile(metaPath, 'utf8');
          const meta = JSON.parse(metaStr);

          if (meta.uploadedAt && now - meta.uploadedAt > MAX_AGE_MS) {
            console.log(`[beat-video] Expired: ${id}`);
            await this.delete(id);
          }
        } catch (error) {
          // Corrupt metadata, delete both files
          await this.delete(id);
        }
      }
    } catch (error) {
      console.error('[beat-video] Cleanup failed:', error);
    }
  }

  async enforceSizeLimit() {
    try {
      const files = await readdir(this.dir);
      const videos = files.filter(f => f.endsWith('.mp4'));

      let totalSize = 0;
      const entries = [];

      for (const file of videos) {
        const id = file.replace('.mp4', '');
        const videoPath = this.videoPath(id);
        const metaPath = this.metaPath(id);

        try {
          const [videoStat, metaStr] = await Promise.all([
            stat(videoPath),
            readFile(metaPath, 'utf8').catch(() => '{}')
          ]);
          const meta = JSON.parse(metaStr);

          entries.push({
            id,
            size: videoStat.size,
            uploadedAt: meta.uploadedAt || 0
          });
          totalSize += videoStat.size;
        } catch (error) {
          // Skip corrupt entries
        }
      }

      if (totalSize > MAX_TOTAL_SIZE) {
        // Delete oldest files until under limit
        entries.sort((a, b) => a.uploadedAt - b.uploadedAt);

        for (const entry of entries) {
          if (totalSize <= MAX_TOTAL_SIZE) break;
          console.log(`[beat-video] Evicting to free space: ${entry.id}`);
          await this.delete(entry.id);
          totalSize -= entry.size;
        }
      }
    } catch (error) {
      console.error('[beat-video] Size limit enforcement failed:', error);
    }
  }

  async close() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

const store = new BeatVideoStore(VIDEO_DIR);

export function createBeatVideoRouter() {
  const router = express.Router();

  // Upload endpoint - receives video from client
  router.post('/api/beat/video/upload', express.raw({ type: 'video/mp4', limit: '12mb' }), async (req, res, next) => {
    try {
      const { recipe, coverId, artist } = req.query;

      if (!recipe) {
        return res.status(400).json({ error: 'Missing recipe parameter' });
      }

      // Parse recipe to get chorus
      let recipeData;
      try {
        recipeData = JSON.parse(Buffer.from(recipe, 'base64url').toString('utf8'));
      } catch {
        return res.status(400).json({ error: 'Invalid recipe format' });
      }

      const id = store.videoId(recipeData, coverId, artist);

      // Check if already exists
      const existing = await store.retrieve(id);
      if (existing) {
        return res.json({ id, status: 'exists', url: `/api/beat/video/${id}.mp4` });
      }

      const videoBuffer = req.body;
      if (!videoBuffer || videoBuffer.length === 0) {
        return res.status(400).json({ error: 'No video data received' });
      }

      await store.store(id, videoBuffer, {
        chorus: recipeData.chorus,
        coverId,
        artist: artist || 'LinkedIn Beats',
      });

      res.json({
        id,
        status: 'uploaded',
        url: `/api/beat/video/${id}.mp4`,
        size: videoBuffer.length,
      });
    } catch (error) {
      console.error('[beat-video] Upload failed:', error);
      next(error);
    }
  });

  // Serve video endpoint
  router.get('/api/beat/video/:id.mp4', async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!/^[a-f0-9]{16}$/.test(id)) {
        return res.status(404).end();
      }

      const result = await store.retrieve(id);

      if (!result) {
        return res.status(404).end();
      }

      res
        .set({
          'Content-Type': 'video/mp4',
          'Cache-Control': 'public, max-age=604800', // 7 days
          'Accept-Ranges': 'bytes',
          'Content-Length': result.video.length,
        })
        .send(result.video);
    } catch (error) {
      console.error('[beat-video] Serve failed:', error);
      next(error);
    }
  });

  // Check if video exists
  router.get('/api/beat/video/:id/exists', async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!/^[a-f0-9]{16}$/.test(id)) {
        return res.json({ exists: false });
      }

      const result = await store.retrieve(id);
      res.json({ exists: !!result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export { store as beatVideoStore };
