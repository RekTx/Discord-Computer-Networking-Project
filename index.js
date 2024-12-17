const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const WebSocket = require("ws");

const currChannels = new Map();
let currTargetPeer = "";

let mainWindow;
let ws;
let currentUsername = "";

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
    } else if (message.type === "chatRequest") {
      console.log(`Chat started with peer: ${message.from}`);
      if (!currChannels.has(message.from)) {
        let messages = [
          {
            from: "Server",
            text: "Connected to peer: " + message.from,
          },
        ];
        currChannels.set(message.from, messages);

        // adding the channel to the chat list
        mainWindow.webContents.send("add-channel", message.from);
      }
      //currTargetPeer = message.from;
      //mainWindow.webContents.send("update-chat", currChannels.get(message.from));
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
  currentUsername = username;
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

ipcMain.handle("get-username", () => {
  return currentUsername;
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


ipcMain.on("start-chat", (event, peer) => {
  if (!currChannels.has(peer)) {
    let messages = [
      {
        from: "Server",
        text: "Connected to peer: " + peer,
      },
    ];
    currChannels.set(peer, messages);
    currTargetPeer = peer;

    // sending a message to the peer to start the chat
    ws.send(
      JSON.stringify({
        type: "requestChat",
        from: currentUsername,
        to: peer,
      })
    );

    console.log(`Starting chat with peer: ${peer}`);
  }
  mainWindow.webContents.send("update-chat", currChannels.get(peer));
});

ipcMain.on("switch-channel", (event, peer) => {
  currTargetPeer = peer;
  console.log(`Switching to chat with peer: ${peer}`);
  mainWindow.webContents.send("update-chat", currChannels.get(peer));
});
