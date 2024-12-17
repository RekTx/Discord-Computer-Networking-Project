const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const WebSocket = require("ws");
const fs = require("fs");

// username, messages
const currChannels = new Map();

let currTargetPeer;

let mainWindow;
let ws;
let primaryws;
let backupws;
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

function encryptMessage(message, key) {
  let encrypted = "";
  for (let i = 0; i < message.length; i++) {
    encrypted += String.fromCharCode(
      message.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return encrypted;
}

function decryptMessage(encryptedMessage, key) {
  let decrypted = "";
  for (let i = 0; i < encryptedMessage.length; i++) {
    decrypted += String.fromCharCode(
      encryptedMessage.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return decrypted;
}

app.whenReady().then(() => {
  mainWindow = createWindow("index.html", "preload-index.js");

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
    } else if (message.type === "signal") {
      const decryptedPayload = decryptMessage(message.payload, message.from);
      console.log(
        `Received message from peer: ${message.from} with encrypted payload: ${message.payload} and is decrypted to: ${decryptedPayload}`
      );
      if (currChannels.has(message.from)) {
        currChannels.get(message.from).push({
          from: message.from,
          text: decryptedPayload,
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
      const decryptedMessage = decryptMessage(message.message, message.from);
      console.log(
        `Received group message from peer: ${message.from} in group: ${message.groupName} with encrypted payload: ${message.message} and is decrypted to: ${decryptedMessage}`
      );
      const groupChannelName = message.groupName;
      if (currChannels.has(groupChannelName)) {
        currChannels.get(groupChannelName).push({
          from: message.from,
          text: decryptedMessage,
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
      console.log(`Received file from peer: ${message.from}`);
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
    } else if (message.type === "deleteMessage") {
      if (message.target.startsWith("group: ")) {
        console.log(
          `Received delete message from peer: ${message.from} text: ${message.messageText}`
        );
        if (currChannels.has(message.target)) {
          const messages = currChannels.get(message.target);
          const index = messages.findIndex(
            (msg) => msg.text === message.messageText
          );
          if (index !== -1) {
            messages.splice(index, 1);
            mainWindow.webContents.send("update-chat", messages);
          }
        }
      } else {
        console.log(
          `Received delete message from peer: ${message.from} text: ${message.messageText}`
        );
        if (currChannels.has(message.from)) {
          const messages = currChannels.get(message.from);
          const index = messages.findIndex(
            (msg) => msg.text === message.messageText
          );
          if (index !== -1) {
            messages.splice(index, 1);
            mainWindow.webContents.send("update-chat", messages);
          }
        }
      }
      //mainWindow.webContents.send("delete-message", message);
    } else if (message.type === "editMessage") {
      if (message.target.startsWith("group: ")) {
        console.log(
          `Received edit message from peer: ${message.from} new text: ${message.newMessageText}`
        );
        if (currChannels.has(message.target)) {
          const messages = currChannels.get(message.target);
          const msg = messages[message.messageId];
          if (msg) {
            msg.text = message.newMessageText;
            mainWindow.webContents.send("update-chat", messages);
          }
        }
      } else {
        console.log(
          `Received edit message from peer: ${message.from} new text: ${message.newMessageText}`
        );
        if (currChannels.has(message.from)) {
          const messages = currChannels.get(message.from);
          const msg = messages[message.messageId];
          if (msg) {
            msg.text = message.newMessageText;
            mainWindow.webContents.send("update-chat", messages);
          }
        }
      }
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
    if (ws.readyState === WebSocket.OPEN && currTargetPeer) {
      const isGroup = currTargetPeer.startsWith("group: ");
      let tempType = "signal";

      if (isGroup) {
        tempType = "sendMessageToGroup";
      }

      const encryptedMessage = encryptMessage(message, currentUsername);

      ws.send(
        JSON.stringify({
          type: tempType,
          target: currTargetPeer,
          payload: encryptedMessage,
        })
      );

      console.log(
        `message sent to ${currTargetPeer} with encrypted payload: ${encryptedMessage}`
      );

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

ipcMain.on("delete-message", (event, target, messageText, messageID) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "deleteMessage",
        target: target,
        messageId: messageID,
        username: currentUsername,
        messageText: messageText,
      })
    );

    // Remove the message from the current channel
    if (currChannels.has(target)) {
      const messages = currChannels.get(target);
      messages.splice(messageID, 1);
      mainWindow.webContents.send("update-chat", messages);
    }
  }
});

ipcMain.on("edit-message", (event, target, messageID, newMessageText) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "editMessage",
        target: target,
        messageId: messageID,
        username: currentUsername,
        newMessageText: newMessageText,
      })
    );

    // Update the message in the current channel
    if (currChannels.has(target)) {
      const messages = currChannels.get(target);
      const message = messages[messageID];
      if (message) {
        message.text = newMessageText;
        mainWindow.webContents.send("update-chat", messages);
      }
    }
  }
});

ipcMain.handle("request-otp", (event, email) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "requestOTP",
        email: email,
      })
    );
    return { success: true };
  } else {
    return { success: false };
  }
});

ipcMain.handle("verify-otp", (event, email, otp) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "verifyOTP",
        email: email,
        otp: otp,
      })
    );

    return new Promise((resolve) => {
      const handleMessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "otpVerified") {
          resolve({ success: true });
          ws.removeEventListener("message", handleMessage);
        } else if (message.type === "otpError") {
          resolve({ success: false });
          ws.removeEventListener("message", handleMessage);
        }
      };

      ws.addEventListener("message", handleMessage);
    });
  } else {
    return { success: false };
  }
});
