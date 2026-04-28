// src/lib/videoMeta.js
// Probe a video file's duration by loading metadata into a hidden <video> element.
// Returns the duration in seconds, or rejects on load error.
export function probeVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('probe_failed'));
    };
    v.src = url;
  });
}
