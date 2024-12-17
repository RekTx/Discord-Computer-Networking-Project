console.log("preload-chat.js loaded");
const { ipcRenderer } = require("electron");

function updatePeersList(peers) {
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
      updateChatHeader(peer); // Update chat header when switching channels
      ipcRenderer.send("add-channel", peer); // Add this line to add the peer to the channel list
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
  messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to the bottom
}

function updateChatHeader(peer) {
  const chatHeader = document.querySelector(".chat-header h2");
  chatHeader.textContent = `- ${peer}`;
}

window.addEventListener("DOMContentLoaded", () => {
  const sendMessageButton = document.getElementById("send-message");
  const messageInput = document.getElementById("message-input");

  if (sendMessageButton) {
    sendMessageButton.addEventListener("click", () => {
      const message = messageInput.value;
      ipcRenderer.send("send-chat-message", message);
      messageInput.value = "";
    });
  }

  if (messageInput) {
    messageInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        sendMessageButton.click();
      }
    });
  }

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
        updateChatHeader(peer); // Update chat header when switching channels
      });
      chatList.appendChild(channel);
    }
  });

  ipcRenderer.on("chat-message", (event, message) => {
    const messagesContainer = document.getElementById("messages-container");
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message");

    const usernameSpan = document.createElement("span");
    usernameSpan.classList.add("username");
    usernameSpan.textContent = `${message.from}:`;

    const textSpan = document.createElement("span");
    textSpan.classList.add("text");
    textSpan.textContent = message.message;

    messageDiv.appendChild(usernameSpan);
    messageDiv.appendChild(textSpan);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to the bottom
  });
  ipcRenderer.invoke("get-peers").then((peers) => {
    updatePeersList(peers);
  });

  ipcRenderer.on("update-peers", (event, peers) => {
    updatePeersList(peers);
  });

  ipcRenderer.on("groupCreated", (event, groupName) => {
    const chatList = document.querySelector(".chat-list");
    const existingChannel = Array.from(chatList.children).find(
      (channel) => channel.textContent === groupName
    );

    if (!existingChannel) {
      const channel = document.createElement("li");
      channel.textContent = groupName;
      channel.classList.add("channel");
      channel.addEventListener("click", () => {
        ipcRenderer.send("switch-channel", groupName);
        updateChatHeader(groupName); // Update chat header when switching channels
      });
      chatList.appendChild(channel);
    }
  });

  const addGroupButton = document.querySelector(".add-group-button");
  const modal = document.getElementById("group-modal");
  const closeModal = document.querySelector(".close");
  const createGroupButton = document.getElementById("create-group");

  addGroupButton.addEventListener("click", () => {
    modal.style.display = "block";
    populatePeersList();
  });

  closeModal.addEventListener("click", () => {
    modal.style.display = "none";
  });

  window.addEventListener("click", (event) => {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  });

  createGroupButton.addEventListener("click", () => {
    const groupName = document.getElementById("group-name").value;
    const selectedPeers = Array.from(
      document.querySelectorAll("#peers-list input[type='checkbox']:checked")
    ).map((checkbox) => checkbox.value);
    ipcRenderer.send("create-group", {
      groupName: groupName,
      sPeers: selectedPeers,
    });
    modal.style.display = "none";
  });

  function populatePeersList() {
    ipcRenderer.invoke("get-peers").then((peers) => {
      const peersList = document.getElementById("peers-list");
      peersList.innerHTML = "";
      peers.forEach((peer) => {
        const peerItem = document.createElement("div");
        peerItem.classList.add("peer-item");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = peer;

        const label = document.createElement("label");
        label.textContent = peer;

        peerItem.appendChild(checkbox);
        peerItem.appendChild(label);
        peersList.appendChild(peerItem);
      });
    });
  }
});
