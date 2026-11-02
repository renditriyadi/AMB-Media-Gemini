// masterPrompt.ts - Master Director System Prompt builder (Agent V1).
// Menggabungkan base prompt + kontrak storyboard + katalog media sesi,
// persis seperti getMasterDirectorSystemPrompt di
// ektension-weavy/js/chat/context-builder.js.
//
// Catatan: blok metadata scraping (product_card) TIDAK digabung di sini karena
// bridge akan menambahkannya sebagai section terpisah (meniru callWeavyLLM
// di ekstensi) supaya data scraping tidak terkirim dua kali.

import { WEAVY_MASTER_DIRECTOR_PROMPT, WEAVY_STORYBOARD_CONTRACT_BLOCK } from '../weavyPrompts';
import { SessionMediaCatalog } from './mediaCatalog';

export interface MasterPromptInput {
  provider?: 'gemini' | 'dola' | 'weavy';
  isStoryboardActive?: boolean;
  sessionMediaCatalog?: SessionMediaCatalog | null;
}

export function buildMasterDirectorSystemPrompt(input: MasterPromptInput = {}): string {
  const { isStoryboardActive = false, sessionMediaCatalog = null } = input;

  let base = WEAVY_MASTER_DIRECTOR_PROMPT;

  if (isStoryboardActive) {
    base += `\n\n${WEAVY_STORYBOARD_CONTRACT_BLOCK}`;
  }

  if (sessionMediaCatalog && Array.isArray(sessionMediaCatalog.mediaList) && sessionMediaCatalog.mediaList.length > 0) {
    base += `\n\n[KATALOG RESMI MEDIA SESI INI (@imgX & @vidX)]\n`;
    sessionMediaCatalog.mediaList.forEach((m) => {
      const durStr = m.duration
        ? ` (Durasi Asli: ${Math.round(m.duration)} detik)`
        : m.type === 'video'
        ? ' (Video Media)'
        : '';
      base += `- ${m.key}: ${m.type === 'video' ? 'Video' : 'Foto'} "${m.name}"${durStr}\n`;
    });
    base += `Aturan Penting Repost: Jika pengguna ingin melihat ulang media lama (misal "mana foto pertama tadi", "tampilkan @img1"), DILARANG menyuruh render ulang dan DILARANG memotong koin. Wajib sertakan tag: [weavy_repost:${
      sessionMediaCatalog.mediaList[0]?.key || '@img1'
    }] agar langsung dimunculkan di UI tanpa kredit.\n`;
  }

  return base;
}
