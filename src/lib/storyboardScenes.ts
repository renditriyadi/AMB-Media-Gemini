// Helper tunggal untuk memastikan daftar scene storyboard selalu unik per sceneNumber.
// Dipakai oleh parser (JSON & markdown), node Canvas, port output, dan inspector.

const countWords = (s: any): number =>
  String(s || '').trim().split(/\s+/).filter(Boolean).length;

// Skor kelayakan sebuah scene bila ada beberapa kandidat dengan nomor yang sama.
// Scene dari blok JSON final (punya shoots, VO 27-30 kata, imagePrompt lengkap) menang
// atas versi draft/ringkas. Jika skor sama, versi yang muncul belakangan dianggap final.
const sceneScore = (sc: any): number => {
  let score = 0;
  if (Array.isArray(sc?.shoots) && sc.shoots.length > 0) score += 2;
  const w = countWords(sc?.voiceover);
  if (w >= 27 && w <= 30) score += 2;
  else if (w > 0) score += 1;
  if (sc?.imagePrompt) score += 1;
  if (sc?.videoPrompt) score += 1;
  return score;
};

// Param bertipe `any` agar pemanggil dengan data node (any) maupun StoryboardCopilotScene[] sama-sama aman.
export function dedupeStoryboardScenes(scenes: any): any[] {
  if (!Array.isArray(scenes) || scenes.length === 0) return [];

  const byNumber = new Map<number, { scene: any; order: number; score: number }>();
  scenes.forEach((sc: any, idx: number) => {
    if (!sc) return;
    const num = Number(sc.sceneNumber) || idx + 1;
    const score = sceneScore(sc);
    const prev = byNumber.get(num);
    // >= : jika skor seimbang, versi yang lebih akhir menimpa (dianggap final)
    if (!prev || score >= prev.score) {
      byNumber.set(num, { scene: sc, order: prev ? prev.order : idx, score });
    }
  });

  // Pertahankan urutan kemunculan pertama tiap nomor, lalu urutkan menurut sceneNumber
  return Array.from(byNumber.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([num, v]) => ({ ...v.scene, sceneNumber: num }));
}
