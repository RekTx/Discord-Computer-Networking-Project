const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const WebSocket = require("ws");

const currChannels = new Map();

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
    } else if (message.type === "peersList") {
      mainWindow.webContents.send("update-peers", message.peers);
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
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "getPeers" }));

    return new Promise((resolve) => {
      const handleMessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "peersList") {
          resolve(message.peers);
          ws.removeEventListener("message", handleMessage); // Clean up the event listener
        } else {
          resolve([]); // Return an empty array if the message type is not "peersList"
        }
      };

      ws.addEventListener("message", handleMessage);
    });
  } else {
    return [];
  }
});
