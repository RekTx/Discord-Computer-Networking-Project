const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const WebSocket = require("ws");
const fs = require("fs");

const currChannels = new Map();
let currTargetPeer = "";

let mainWindow;
let ws;
let currentUsername = "";

function createWindow(file, preload) {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, preload),
      nodeIntegration: true,
    },
  });

  win.loadFile(file);
  win.setMenuBarVisibility(false);
  return win;
}

app.whenReady().then(() => {
  mainWindow = createWindow("index.html", "preload-index.js");

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
      // mainWindow.webContents.send(
      //   "update-chat",
      //   currChannels.get(message.from)
      // );
    } else if (message.type === "signal") {
      console.log(`Received message from peer: ${message.from}`);
      if (currChannels.has(message.from)) {
        currChannels.get(message.from).push({
          from: message.from,
          text: message.payload,
        });

        if (currTargetPeer === message.from) {
          mainWindow.webContents.send(
            "update-chat",
            currChannels.get(message.from)
          );
        }
      }
      //mainWindow.webContents.send("chat-message", message);
    } else if (message.type === "groupCreated") {
      const groupChannelName = message.groupName;
      if (!currChannels.has(groupChannelName)) {
        // add a message to the group channel saying it was created with names of members
        let messages = [
          {
            from: "Server",
            text:
              "Group created: " +
              groupChannelName +
              " with members: " +
              message.groupMembers.join(", "),
          },
        ];
        currChannels.set(groupChannelName, messages);
      }
      mainWindow.webContents.send("groupCreated", groupChannelName);
    } else if (message.type === "groupMessage") {
      console.log(`Received group message from peer: ${message.from}`);
      const groupChannelName = message.groupName;
      if (currChannels.has(groupChannelName)) {
        currChannels.get(groupChannelName).push({
          from: message.from,
          text: message.message,
        });

        if (currTargetPeer === groupChannelName) {
          mainWindow.webContents.send(
            "update-chat",
            currChannels.get(groupChannelName)
          );
        }
      }
      //mainWindow.webContents.send("chat-message", message);
    } else if (message.type === "fileReceived") {
      // if (currChannels.has(message.from)) {
      //   currChannels.get(message.from).push({
      //     from: message.from,
      //     text: message.fileName,
      //     fileContent: message.fileContent,
      //   });

      //   if (currTargetPeer === message.from) {
      //     mainWindow.webContents.send(
      //       "update-chat",
      //       currChannels.get(message.from)
      //     );
      //   }
      // }

      console.log(`Received file from peer: ${message.from}`);

      // currChannels.get(message.from).push({
      //   from: message.from,
      //   text: message.fileName,
      //   fileContent: message.fileContent,
      // });

      // if (currTargetPeer === message.from) {
      //   mainWindow.webContents.send(
      //     "update-chat",
      //     currChannels.get(message.from)
      //   );
      // }

      const file = {
        fileName: message.fileName,
        fileContent: message.fileContent,
        from: message.from,
      };

      mainWindow.webContents.send("fileReceived", file);
    } else if (message.type === "fileContent") {
      console.log(`Received file content from peer: ${message.from}`);
      const file = {
        fileName: message.fileName,
        fileContent: message.fileContent,
      };
      mainWindow.webContents.send("fileContent", file);
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
  const chatWindow = createWindow("chat.html", "preload-chat.js");
  mainWindow.close();
  mainWindow = chatWindow;
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

ipcMain.on("send-chat-message", (event, message, file) => {
  if (file) {
    const { fileName, fileContent } = file;
    ws.send(
      JSON.stringify({
        type: "fileTransfer",
        target: currTargetPeer,
        fileName: fileName,
        fileContent: fileContent,
      })
    );

    // Sending message in chat saying file is sent
    if (currChannels.has(currTargetPeer)) {
      currChannels.get(currTargetPeer).push({
        from: currentUsername,
        text: "File sent: " + fileName,
      });
      mainWindow.webContents.send(
        "update-chat",
        currChannels.get(currTargetPeer)
      );
    }
  } else {
    console.log("Sending message: ", message);
    console.log("Current target peer: ", currTargetPeer);
    if (ws.readyState === WebSocket.OPEN && currTargetPeer) {
      const isGroup = currTargetPeer.startsWith("group: ");
      let tempType = "signal";

      if (isGroup) {
        tempType = "sendMessageToGroup";
      }

      ws.send(
        JSON.stringify({
          type: tempType,
          target: currTargetPeer,
          payload: message,
        })
      );

      console.log("message sent with type: ", tempType);
      console.log("message sent to: ", currTargetPeer);
      console.log("message sent with payload: ", message);

      // Add the message to the current channel
      if (currChannels.has(currTargetPeer)) {
        currChannels.get(currTargetPeer).push({
          from: currentUsername,
          text: message,
        });
        mainWindow.webContents.send(
          "update-chat",
          currChannels.get(currTargetPeer)
        );
      }
    }
  }
});

ipcMain.on("create-group", (event, group) => {
  console.log("Creating group: ", group);

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "createGroup",
        groupName: group.groupName,
        selectedPeers: group.sPeers,
      })
    );

    // Add the group to currChannels
    if (!currChannels.has(group.groupName)) {
      let messages = [
        {
          from: "Server",
          text:
            "New " +
            group.groupName +
            " with members: " +
            group.sPeers.join(", "),
        },
      ];
      currChannels.set(group.groupName, messages);

      // setting the channel as the current channel
      // currTargetPeer = group.groupName;
      // mainWindow.webContents.send(
      //   "update-chat",
      //   currChannels.get(group.groupName)
      // );
    }

    //mainWindow.webContents.send("groupCreated", groupChannelName);
  }
});

ipcMain.on("add-channel", (event, peer) => {
  mainWindow.webContents.send("add-channel", peer);
});

ipcMain.handle("save-file", (event, fileName, fileContent) => {
  const userDir = path.join(__dirname, "p2pfiles_" + currentUsername);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir);
  }
  const filePath = path.join(userDir, fileName);
  fs.writeFileSync(filePath, fileContent, "base64");
});

ipcMain.handle("get-file-content", (event, fileName) => {
  const filePath = path.join(
    __dirname,
    "p2pfiles_" + currentUsername,
    fileName
  );
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "base64");
  }
  return null;
});

ipcMain.handle("get-server-file-content", (event, fileName) => {
  const filePath = path.join(__dirname, "p2pfiles_server", fileName);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "base64");
  }
  return null;
});

ipcMain.on("accept-file", (event, fileName, from) => {
  ws.send(
    JSON.stringify({
      type: "acceptFile",
      fileName: fileName,
      from: from,
    })
  );
});
