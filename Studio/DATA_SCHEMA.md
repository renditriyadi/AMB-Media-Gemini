# 🗄️ STUDIO DATA SCHEMA & TYPES SPECIFICATION

Dokumen ini mendefinisikan skema data TypeScript dan entitas IndexedDB untuk proyek Studio.

---

## 1. 📋 TypeScript Data Interfaces

```typescript
// /src/types/studio.ts

export type StudioAspectRatio = '9:16' | '16:9' | '1:1';

export type StudioImageModel = 'gpt-image-2.5' | 'seedream-v5.0' | 'grok-imagine' | 'nano-banana-pro';

export interface StudioVideoMetadata {
  url?: string;
  title: string;
  author: string;
  audioName?: string;
  thumbnailUrl?: string;
  duration?: number;
  tags?: string[];
}

export interface StudioAnalysis {
  hookAnalysis: string;
  productOrTopicName: string;
  targetAudience: string;
  coreUSPs: string[];
  visualProofStrategy: string;
  callToActionAnalysis: string;
}

export interface StudioScene {
  id: string;
  sceneNumber: number;
  title: string;
  durationSec: number;
  sceneGoal: string;
  visualDescription: string;
  cameraAngle: string;
  imagePrompt: string;
  imageUrl?: string;
  status: 'idle' | 'generating' | 'completed' | 'failed';
  errorMessage?: string;
  generatedAt?: string;
}

export interface StudioCompositeConfig {
  gridColumns: number; // default: 3
  gridRows: number;    // default: 2
  showBadges: boolean;
  showTitleBanner: boolean;
  titleText?: string;
  borderColor: string;
  borderWidth: number;
  padding: number;
  aspectRatio: '16:9' | '9:16';
}

export interface StudioProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  videoSource?: {
    type: 'url' | 'upload';
    urlOrFilename: string;
    metadata?: StudioVideoMetadata;
  };
  analysis?: StudioAnalysis;
  scenes: StudioScene[];
  aspectRatio: StudioAspectRatio;
  imageModel: StudioImageModel;
  compositeConfig: StudioCompositeConfig;
  compositeImageUrl?: string;
}
```

---

## 2. 💽 IndexedDB Schema (`studio_database`)

* **Database Name**: `Aistudio_StudioDB`
* **Version**: `1`
* **Object Store**: `studio_projects`
  * **Key Path**: `id` (string UUID)
  * **Indexes**:
    * `createdAt`: Index untuk pengurutan kronologis.
    * `updatedAt`: Index untuk proyek yang baru saja diedit.
    * `name`: Index untuk pencarian nama proyek.
