// Upload generated video to server for LinkedIn video embeds

export async function uploadBeatVideo(videoBlob, recipe, coverId, artist = '') {
  try {
    // Encode recipe for URL
    const recipeParam = btoa(JSON.stringify({ chorus: recipe.chorus }));

    const params = new URLSearchParams({
      recipe: recipeParam,
      coverId: coverId || 'paper-jam',
    });

    if (artist) {
      params.set('artist', artist);
    }

    const response = await fetch(`/api/beat/video/upload?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'video/mp4',
      },
      body: videoBlob,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || `Upload failed: ${response.status}`);
    }

    const result = await response.json();
    return {
      id: result.id,
      url: result.url,
      status: result.status, // 'uploaded' or 'exists'
    };
  } catch (error) {
    console.error('[video-upload] Failed:', error);
    throw error;
  }
}

export async function checkVideoExists(recipe, coverId, artist = '') {
  try {
    // Generate the same video ID hash as the server
    const data = JSON.stringify({ chorus: recipe.chorus, cover: coverId, artist });
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    const id = Math.abs(hash).toString(16).padStart(16, '0').slice(0, 16);

    const response = await fetch(`/api/beat/video/${id}/exists`);
    const result = await response.json();
    return result.exists;
  } catch (error) {
    return false;
  }
}
