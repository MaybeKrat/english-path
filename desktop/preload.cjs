const { contextBridge, ipcRenderer, webFrame } = require("electron");

contextBridge.exposeInMainWorld("oxfordAudio", Object.freeze({
  prepare: (text) => ipcRenderer.invoke("oxford:speech:prepare", text),
}));

contextBridge.exposeInMainWorld("oxfordTheme", Object.freeze({
  setSource: (source) => ipcRenderer.invoke("oxford:theme:set-source", source),
}));

// Interface scale from the settings; Chromium zoom keeps the responsive layout working.
contextBridge.exposeInMainWorld("oxfordZoom", Object.freeze({
  set: (factor) => {
    if (typeof factor === "number" && factor >= 0.5 && factor <= 3) webFrame.setZoomFactor(factor);
  },
}));
