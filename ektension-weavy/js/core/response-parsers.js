export function extractTextFromResult(targetObj) {
  if (!targetObj) return '';
  if (typeof targetObj === 'string') {
    const trimmed = targetObj.trim();
    if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return trimmed;
    return trimmed;
  }
  if (Array.isArray(targetObj)) {
    for (const item of targetObj) {
      const text = extractTextFromResult(item);
      if (text) return text;
    }
  }
  if (typeof targetObj === 'object') {
    if (typeof targetObj.value === 'string' && targetObj.value.trim()) return targetObj.value.trim();
    if (typeof targetObj.text === 'string' && targetObj.text.trim()) return targetObj.text.trim();
    if (typeof targetObj.output === 'string' && targetObj.output.trim()) return targetObj.output.trim();
    if (typeof targetObj.response === 'string' && targetObj.response.trim()) return targetObj.response.trim();
    if (typeof targetObj.content === 'string' && targetObj.content.trim()) return targetObj.content.trim();
    if (typeof targetObj.prompt === 'string' && targetObj.prompt.trim()) return targetObj.prompt.trim();

    if (targetObj.text && typeof targetObj.text === 'object') {
      const text = extractTextFromResult(targetObj.text);
      if (text) return text;
    }
    if (targetObj.output && typeof targetObj.output === 'object') {
      const text = extractTextFromResult(targetObj.output);
      if (text) return text;
    }
    if (targetObj.result && typeof targetObj.result === 'object') {
      const text = extractTextFromResult(targetObj.result);
      if (text) return text;
    }
  }
  return '';
}

export function extractMediaUrlFromObject(obj, excludeUrls = []) {
  if (!obj) return null;
  const isExcluded = (u) => {
    if (!u || typeof u !== 'string') return false;
    const cleanU = u.trim();
    return excludeUrls.some((ex) => ex && (cleanU === ex.trim() || cleanU.includes(ex.trim()) || (ex.length > 20 && ex.trim().includes(cleanU))));
  };

  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if ((trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image')) && !isExcluded(trimmed)) {
      return trimmed;
    }
    return null;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = extractMediaUrlFromObject(item, excludeUrls);
      if (found) return found;
    }
    return null;
  }
  if (typeof obj === 'object') {
    for (const key of ['resultUrl', 'outputUrl', 'imageUrl', 'image', 'url']) {
      if (typeof obj[key] === 'string' && (obj[key].startsWith('http://') || obj[key].startsWith('https://'))) {
        if (!isExcluded(obj[key])) return obj[key].trim();
      }
    }
    if (obj.result && (typeof obj.result === 'string' || typeof obj.result === 'object')) {
      const res = extractMediaUrlFromObject(obj.result, excludeUrls);
      if (res) return res;
    }
    if (obj.output && (typeof obj.output === 'string' || typeof obj.output === 'object')) {
      const res = extractMediaUrlFromObject(obj.output, excludeUrls);
      if (res) return res;
    }
    if (obj.file && (typeof obj.file === 'string' || typeof obj.file === 'object')) {
      const res = extractMediaUrlFromObject(obj.file, excludeUrls);
      if (res) return res;
    }
    for (const key of Object.keys(obj)) {
      if (key === 'input' || key === 'params' || key === 'inputs' || key === 'parameters') continue;
      const val = obj[key];
      if (typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'))) {
        if (!isExcluded(val)) return val.trim();
      }
      if (typeof val === 'object' && val !== null) {
        const sub = extractMediaUrlFromObject(val, excludeUrls);
        if (sub) return sub;
      }
    }
  }
  return null;
}
