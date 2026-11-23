import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Polyfill HTMLMediaElement in jsdom for PlayerContext tests
window.HTMLMediaElement.prototype.load = () => {};
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

// Polyfill URL.createObjectURL and URL.revokeObjectURL for jsdom
if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn(() => `blob:mock-url-${Math.random().toString(36).substring(2)}`);
}
if (!window.URL.revokeObjectURL) {
  window.URL.revokeObjectURL = vi.fn();
}

// Polyfill Blob.prototype.arrayBuffer and File.prototype.arrayBuffer for jsdom
if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

if (!File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}
