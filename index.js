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

ipcMain.handle("send-username", (event, username) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "setUsername",
        username: username,
      })
    );
    return { success: true };
  } else {
    return { success: false };
  }
});

ipcMain.handle("get-websocket", () => {
  return ws;
});

ipcMain.handle("get-peers", async () => {
  console.log("get-peers");
  if (ws.readyState === WebSocket.OPEN) {
    console.log("get-peers, websocket open");
    ws.send(JSON.stringify({ type: "getPeers" }));
    console.log("get-peers, ws.send");
    return new Promise((resolve) => {
      ws.onmessage = (event) => {
        console.log("get-peers, onmessage");
        const message = JSON.parse(event.data);
        if (message.type === "peersList") {
          console.log("Peers on the server: ", peers.keys());
          resolve(message.peers);
        }
      };
    });
  } else {
    return [];
  }
});
