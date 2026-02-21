"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
function createWindow() {
    const mainWindow = new electron_1.BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#07071a',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    mainWindow.maximize();
    mainWindow.loadFile(node_path_1.default.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'));
}
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
