// mediaCatalog.ts - Katalog media sesi (@imgX / @vidX).
// Port dari ektension-weavy/js/chat/chat-media.js (buildSessionMediaCatalog).

export interface SessionMediaItem {
  id: string;
  key: string;
  type: 'image' | 'video';
  name: string;
  url?: string;
  base64?: string;
  thumbnailUrl?: string | null;
  embedUrl?: string | null;
  platform?: string;
  author_name?: string | null;
  duration?: number | null;
  asset?: unknown;
  isPending: boolean;
}

export interface SessionMediaCatalog {
  mediaList: SessionMediaItem[];
  mediaMap: Record<string, SessionMediaItem>;
}

type AnyMsg = {
  id?: string;
  role?: string;
  content?: string;
  attachments?: any[];
  extractedProducts?: any[];
  generatedImage?: { url?: string; modelName?: string } | null;
  tiktokData?: any;
  videoPreviews?: any[];
};

export function buildSessionMediaCatalog(
  session: { messages?: AnyMsg[] } | null | undefined,
  pendingAttachments: any[] = []
): SessionMediaCatalog {
  const mediaList: SessionMediaItem[] = [];
  const mediaMap: Record<string, SessionMediaItem> = {};
  let nextImgNum = 1;
  let nextVidNum = 1;

  const findExisting = (url?: string | null, base64?: string | null, id?: string | null) => {
    if (!url && !base64 && !id) return null;
    return mediaList.find((m) => {
      if (id && m.id && m.id === id) return true;
      if (url && m.url && m.url === url) return true;
      if (base64 && m.base64 && m.base64 === base64) return true;
      return false;
    });
  };

  const allocateKey = (isVideo: boolean): string => {
    if (isVideo) {
      let key = `@vid${nextVidNum++}`;
      while (mediaMap[key.toLowerCase()]) key = `@vid${nextVidNum++}`;
      return key;
    }
    let key = `@img${nextImgNum++}`;
    while (mediaMap[key.toLowerCase()]) key = `@img${nextImgNum++}`;
    return key;
  };

  if (session && Array.isArray(session.messages)) {
    session.messages.forEach((msg) => {
      // 1. Video previews hasil deteksi link
      if (Array.isArray(msg.videoPreviews)) {
        msg.videoPreviews.forEach((vp: any) => {
          const existing = findExisting(vp.url, null, vp.videoId);
          if (existing) {
            vp.tagKey = existing.key;
            return;
          }
          const key = allocateKey(true);
          vp.tagKey = key;
          const item: SessionMediaItem = {
            id: vp.videoId || `vid_${Date.now()}_${key.replace('@', '')}`,
            key,
            type: 'video',
            name: vp.title || (vp.platform ? `${vp.platform} Video` : 'Video Referensi'),
            url: vp.url,
            thumbnailUrl: vp.thumbnailUrl || null,
            embedUrl: vp.embedUrl || null,
            platform: vp.platform || 'Video',
            author_name: vp.author_name || null,
            isPending: false,
          };
          mediaList.push(item);
          mediaMap[key.toLowerCase()] = item;
        });
      }

      // 1b. Galeri produk hasil ekstraksi AI Worker
      if (Array.isArray(msg.extractedProducts)) {
        msg.extractedProducts.forEach((prod: any) => {
          if (!Array.isArray(prod.images)) return;
          prod.images.forEach((imgObj: any) => {
            const imgUrl = typeof imgObj === 'string' ? imgObj : imgObj?.url;
            if (!imgUrl) return;
            const existing = findExisting(imgUrl, imgUrl.startsWith('data:') ? imgUrl : null, null);
            if (existing) return;
            const key = allocateKey(false);
            const item: SessionMediaItem = {
              id: `prod_img_${key.replace('@', '')}`,
              key,
              type: 'image',
              name:
                typeof imgObj === 'object' && imgObj.title
                  ? imgObj.title
                  : `Foto Produk (${prod.title ? String(prod.title).slice(0, 20) : 'TikTok'})`,
              url: imgUrl,
              base64: imgUrl.startsWith('data:') ? imgUrl : undefined,
              asset: null,
              isPending: false,
            };
            mediaList.push(item);
            mediaMap[key.toLowerCase()] = item;
          });
        });
      }

      // 1c. Media TikTok terunduh (cover + video)
      let tiktokObj = msg.tiktokData;
      if (!tiktokObj && typeof msg.content === 'string' && msg.content.includes('[tiktok_card:')) {
        const match = msg.content.match(/\[tiktok_card:([\s\S]*?)\]/i);
        if (match && match[1]) {
          try {
            tiktokObj = JSON.parse(decodeURIComponent(match[1]));
          } catch {
            try {
              tiktokObj = JSON.parse(match[1]);
            } catch {
              /* ignore */
            }
          }
        }
      }
      if (tiktokObj && typeof tiktokObj === 'object') {
        const cover = tiktokObj.cover || tiktokObj.rawCover;
        const play = tiktokObj.play || tiktokObj.rawPlay || tiktokObj.downloadUrl;
        if (cover && !findExisting(cover, null, `tiktok_cover_${tiktokObj.id}`)) {
          const key = allocateKey(false);
          const item: SessionMediaItem = {
            id: `tiktok_cover_${tiktokObj.id || key.replace('@', '')}`,
            key,
            type: 'image',
            name: `Thumbnail: ${tiktokObj.cleanTitle ? String(tiktokObj.cleanTitle).slice(0, 30) : 'Video TikTok'}`,
            url: cover,
            thumbnailUrl: cover,
            isPending: false,
          };
          mediaList.push(item);
          mediaMap[key.toLowerCase()] = item;
        }
        if (play && !findExisting(play, null, `tiktok_vid_${tiktokObj.id}`)) {
          const key = allocateKey(true);
          const item: SessionMediaItem = {
            id: `tiktok_vid_${tiktokObj.id || key.replace('@', '')}`,
            key,
            type: 'video',
            name: `${tiktokObj.cleanTitle ? String(tiktokObj.cleanTitle).slice(0, 30) : 'Video TikTok'}.mp4`,
            url: play,
            thumbnailUrl: cover || null,
            duration: tiktokObj.duration || 0,
            isPending: false,
          };
          mediaList.push(item);
          mediaMap[key.toLowerCase()] = item;
        }
      }

      // 2. Lampiran user
      if (Array.isArray(msg.attachments)) {
        msg.attachments.forEach((att: any) => {
          const isVideo =
            att.type === 'video' || (att.name && /\.(mp4|mov|webm|avi|mkv)$/i.test(att.name));
          const attUrl = att.url || att.base64;
          const existing = findExisting(attUrl, att.base64, att.id);
          if (existing) {
            att.tagKey = existing.key;
            return;
          }
          const key = allocateKey(isVideo);
          att.tagKey = key;
          const item: SessionMediaItem = {
            id: att.id || `att_${Date.now()}_${key.replace('@', '')}`,
            key,
            type: isVideo ? 'video' : 'image',
            name: att.name || (isVideo ? 'Video Referensi' : 'Foto Referensi'),
            url: attUrl,
            base64: att.base64,
            asset: att.asset || null,
            duration: att.duration || (isVideo ? 24 : null),
            isPending: false,
          };
          mediaList.push(item);
          mediaMap[key.toLowerCase()] = item;
        });
      }

      // 3. Gambar hasil generate
      if (msg.generatedImage && msg.generatedImage.url) {
        const genUrl = msg.generatedImage.url;
        if (!findExisting(genUrl, null, null)) {
          const key = allocateKey(false);
          const item: SessionMediaItem = {
            id: `gen_img_${key.replace('@', '')}`,
            key,
            type: 'image',
            name: `Hasil Render (${msg.generatedImage.modelName || 'Weavy AI'})`,
            url: genUrl,
            base64: undefined,
            asset: null,
            isPending: false,
          };
          mediaList.push(item);
          mediaMap[key.toLowerCase()] = item;
        }
      }
    });
  }

  // 4. Lampiran yang masih di input tray
  if (Array.isArray(pendingAttachments) && pendingAttachments.length > 0) {
    pendingAttachments.forEach((att: any) => {
      const isVideo =
        att.type === 'video' || (att.name && /\.(mp4|mov|webm|avi|mkv)$/i.test(att.name));
      const attUrl = att.url || att.base64;
      const existing = findExisting(attUrl, att.base64, att.id);
      if (existing) {
        att.tagKey = existing.key;
        return;
      }
      const key = allocateKey(isVideo);
      att.tagKey = key;
      const item: SessionMediaItem = {
        id: att.id || `pending_${Date.now()}_${key.replace('@', '')}`,
        key,
        type: isVideo ? 'video' : 'image',
        name: att.name || (isVideo ? 'Video Terlampir' : 'Foto Terlampir'),
        url: attUrl,
        base64: att.base64 || (attUrl?.startsWith('data:') ? attUrl : undefined),
        asset: att.asset || null,
        isPending: true,
      };
      mediaList.push(item);
      mediaMap[key.toLowerCase()] = item;
    });
  }

  return { mediaList, mediaMap };
}
