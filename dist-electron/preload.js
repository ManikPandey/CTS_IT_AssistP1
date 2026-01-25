"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('api', {
    // Example: window.api.send('channel', data)
    send: (channel, data) => {
        // Whitelist channels
        let validChannels = ["toMain"];
        if (validChannels.includes(channel)) {
            electron_1.ipcRenderer.send(channel, data);
        }
    },
    // Example: window.api.receive('channel', (data) => { ... })
    receive: (channel, func) => {
        let validChannels = ["fromMain"];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            electron_1.ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    // We will add database methods here later (e.g. getAssets, createPO)
});
