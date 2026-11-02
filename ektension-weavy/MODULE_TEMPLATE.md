# Module Template untuk Feature Baru

## Tujuan
Dokumen ini adalah template standar untuk membuat module baru di folder menu yang sesuai. Gunakan template ini saat menambah fitur baru agar tetap konsisten dengan arsitektur proyek.

## Prinsip dasar
- module hanya punya satu concern utama
- `sidepanel.js` tidak perlu tahu detail implementasi module
- nama file harus menjelaskan fungsi inti
- export fungsi harus jelas dan simpel
- logic shared masuk ke `js/core/`

## Template struktur module

```js
export function featureName(input, options = {}) {
  // logic utama fitur
  return result;
}

export function initFeatureUi({ documentRef = document, storage = null, ...deps } = {}) {
  // inisialisasi DOM dan event
  // return API kecil jika dibutuhkan
  return {
    open,
    close,
    refresh,
  };
}
```

## Aturan penulisan
### 1. Nama file
Gunakan format:
- `feature-name.js`
- `feature-view.js`
- `feature-session.js`
- `feature-intent.js`

Contoh:
- `storyboard-intent.js`
- `library-view.js`
- `chat-session.js`

### 2. Fungsi export
Setiap module harus punya fungsi yang jelas. Hindari export yang terlalu banyak dan acak.

Contoh yang bagus:
```js
export function buildStoryboardReview(project, references = {}) { ... }
export function buildStoryboardCopilotIntentAction(options, referenceImages = []) { ... }
```

### 3. Jangan menaruh logic UI di satu file raksasa
Jika fitur berhubungan dengan UI dan logic, tetap pisah:
- file UI / render -> `feature-view.js`
- file logic / helper -> `feature-intent.js` atau `feature-session.js`

### 4. Module tidak boleh punya banyak concern
Contoh yang buruk:
- satu file mengurus UI, API, parsing, validation, review, dan state storage semuanya sekaligus

Contoh yang benar:
- file A = parsing intent
- file B = render view
- file C = session state

## Contoh alur kerja benar
### A. Jika fitur ada di storyboard
```js
// sidepanel.js
import { buildStoryboardCopilotIntentAction } from './js/storyboard/storyboard-intent.js';

const action = buildStoryboardCopilotIntentAction({
  text: userText,
  currentSbProject,
  currentAspect,
});
```

### B. Jika fitur shared di banyak menu
```js
// js/core/storage.js
export async function saveToStorage(key, value) {
  // shared logic
}
```

## Checklist sebelum module dianggap rapi
- [ ] file punya satu concern utama
- [ ] nama file sesuai fungsi
- [ ] export fungsi jelas
- [ ] tidak ada logic besar di `sidepanel.js`
- [ ] logic shared dipindah ke `js/core/`
- [ ] module bisa dipanggil ulang oleh module lain
- [ ] tidak mengandung isi yang bersifat global dan acak

## Contoh struktur folder yang disarankan
```text
js/
  account/
    account-auth.js
    account-session.js
  chat/
    chat-session.js
    chat-render.js
  generator/
    model-controls.js
    recent-generations.js
  library/
    library-view.js
    image-source-picker.js
  storyboard/
    storyboard-intent.js
    storyboard-copilot.js
    storyboard-render.js
  core/
    api.js
    storage.js
    utils.js
```

## Kesimpulan
Semua fitur baru harus dibuat dalam module yang spesifik dan jelas. Dengan pola ini, project tetap modular, mudah dilanjutkan, dan tidak membebani `sidepanel.js`.
