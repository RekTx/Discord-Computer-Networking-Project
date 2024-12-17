const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const WebSocket = require("ws");

let mainWindow;
let ws;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // If you have preload.js
      nodeIntegration: true, // Enable Node.js features (if needed)
    },
  });

  mainWindow.loadFile("index.html");
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();

  // Create WebSocket connection
  ws = new WebSocket("ws://localhost:8081");

  ws.onopen = () => {
    console.log("Connected to the server");
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "welcome") {
      console.log(`Welcome ${message.id}`);
    }
  };
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    ws.close();
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.on("login-success", (event, username) => {
  mainWindow.loadFile("chat.html");
  mainWindow.setMenuBarVisibility(false);
});

ipcMain.handle("get-websocket", () => {
  return ws;
});
