import { GenerationItem } from '../types';

// Riwayat awal saat localStorage masih kosong (dipakai sebagai fallback di App.tsx).
// Dibiarkan kosong supaya tidak ada data palsu yang muncul di History.
export const INITIAL_GENERATIONS: GenerationItem[] = [];
