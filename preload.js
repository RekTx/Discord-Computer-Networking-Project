const { ipcRenderer } = require("electron");
let peername = "";

function updatePeersList(peers) {
  console.log("Peers on the server: ", peers.keys());
  const userList = document.querySelector(".user-list ul");
  userList.innerHTML = "";
  peers.forEach((peer) => {
    const li = document.createElement("li");
    li.textContent = peer;

    const chatButton = document.createElement("button");
    chatButton.textContent = "Chat";
    chatButton.classList.add("chat-button");
    chatButton.setAttribute("data-peer", peer);

    chatButton.addEventListener("click", () => {
      ipcRenderer.send("start-chat", peer);

      // Add a new channel to the sidebar only if it doesn't already exist
      const chatList = document.querySelector(".chat-list");
      const existingChannel = Array.from(chatList.children).find(
        (channel) => channel.textContent === peer
      );

      if (!existingChannel) {
        const channel = document.createElement("li");
        channel.textContent = peer;
        channel.classList.add("channel");
        channel.addEventListener("click", () => {
          ipcRenderer.send("switch-channel", peer);
        });
        chatList.appendChild(channel);
      }
    });

    li.appendChild(chatButton);
    userList.appendChild(li);
  });
}

function updateChatMessages(messages) {
  const messagesContainer = document.getElementById("messages-container");
  messagesContainer.innerHTML = "";
  messages.forEach((message) => {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message");

    const usernameSpan = document.createElement("span");
    usernameSpan.classList.add("username");
    usernameSpan.textContent = `${message.from}:`;

    const textSpan = document.createElement("span");
    textSpan.classList.add("text");
    textSpan.textContent = message.text;

    messageDiv.appendChild(usernameSpan);
    messageDiv.appendChild(textSpan);
    messagesContainer.appendChild(messageDiv);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = loginForm.elements["username"].value;
    peername = username;

    console.log("Form submitted, username:", username);

    ipcRenderer.invoke("send-username", username).then((response) => {
      if (response.success) {
        console.log("Username sent to server");
        window.location.href = "chat.html"; // Navigate to chat.html
      } else {
        console.error("WebSocket is not open");
      }
    });

    ipcRenderer.send("login-success", username);
  });

  const msgForm = document.getElementById("message-form");

  msgForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = msgForm.elements["message"].value;
    console.log("Message submitted: ", message);
    ipcRenderer.send("send-message", message);
    msgForm.elements["message"].value = "";
  });
});

ipcRenderer.invoke("get-peers").then((peers) => {
  console.log("Peers on the server: ", peers.keys());
  updatePeersList(peers);
});

// Listen for updates to the peers list
ipcRenderer.on("update-peers", (event, peers) => {
  updatePeersList(peers);
});

ipcRenderer.on("update-chat", (event, messages) => {
  updateChatMessages(messages);
});

ipcRenderer.on("add-channel", (event, peer) => {
  const chatList = document.querySelector(".chat-list");
  const existingChannel = Array.from(chatList.children).find(
    (channel) => channel.textContent === peer
  );

  if (!existingChannel) {
    const channel = document.createElement("li");
    channel.textContent = peer;
    channel.classList.add("channel");
    channel.addEventListener("click", () => {
      ipcRenderer.send("switch-channel", peer);
    });
    chatList.appendChild(channel);
  }
});
