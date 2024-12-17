console.log("preload-chat.js loaded");
const { ipcRenderer } = require("electron");

let currentChannel = "";

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
  currentChannel = peer;
}

function handleFilePreview(fileName, fileContent) {
  const filePreviewModal = document.getElementById("file-preview-modal");
  const filePreviewContent = document.getElementById("file-preview-content");

  if (fileName.endsWith(".txt")) {
    const pre = document.createElement("pre");
    pre.textContent = atob(fileContent);
    filePreviewContent.innerHTML = "";
    filePreviewContent.appendChild(pre);
  } else if (fileName.endsWith(".png") || fileName.endsWith(".jpg")) {
    const img = document.createElement("img");
    img.src = `data:image/png;base64,${fileContent}`;
    filePreviewContent.innerHTML = "";
    filePreviewContent.appendChild(img);
  }

  const saveButton = document.createElement("button");
  saveButton.textContent = "Save File";
  saveButton.addEventListener("click", () => {
    saveFile(fileName, fileContent);
    filePreviewModal.style.display = "none";
  });

  filePreviewContent.appendChild(saveButton);
  filePreviewModal.style.display = "block";
}

function saveFile(fileName, fileContent) {
  ipcRenderer.invoke("save-file", fileName, fileContent);
}

ipcRenderer.on("fileReceived", (event, message) => {
  const messagesContainer = document.getElementById("messages-container");
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message");

  const usernameSpan = document.createElement("span");
  usernameSpan.classList.add("username");
  usernameSpan.textContent = `${message.from}:`;

  const fileLink = document.createElement("span");
  fileLink.classList.add("text");
  fileLink.textContent = message.fileName;
  fileLink.style.cursor = "pointer";
  fileLink.addEventListener("click", () => {
    const acceptFile = confirm(`Do you want to accept the file: ${message.fileName}?`);
    if (acceptFile) {
      ipcRenderer.send("accept-file", message.fileName, message.from);
    }
  });

  messageDiv.appendChild(usernameSpan);
  messageDiv.appendChild(fileLink);
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

ipcRenderer.on("fileContent", (event, file) => {
  handleFilePreview(file.fileName, file.fileContent);
});

window.addEventListener("DOMContentLoaded", () => {
  const sendMessageButton = document.getElementById("send-message");
  const messageInput = document.getElementById("message-input");
  const fileInput = document.getElementById("file-input");

  if (sendMessageButton) {
    sendMessageButton.addEventListener("click", () => {
      const message = messageInput.value;
      const files = Array.from(fileInput.files);

      if (files.length > 0) {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = () => {
          const fileContent = reader.result.split(",")[1];
          ipcRenderer.send("send-chat-message", message, {
            fileName: file.name,
            fileContent: fileContent,
          });
        };
        reader.readAsDataURL(file);
      } else {
        ipcRenderer.send("send-chat-message", message);
      }

      messageInput.value = "";
      fileInput.value = "";
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
    const groupChannelName = groupName;
    const existingChannel = Array.from(chatList.children).find(
      (channel) => channel.textContent === groupChannelName
    );

    if (!existingChannel) {
      const channel = document.createElement("li");
      channel.textContent = groupChannelName;
      channel.classList.add("channel");
      channel.addEventListener("click", () => {
        ipcRenderer.send("switch-channel", groupChannelName);
        updateChatHeader(groupChannelName); // Update chat header when switching channels
      });
      chatList.appendChild(channel);
    }
  });

  ipcRenderer.on("switch-channel", (event, peer) => {
    updateChatHeader(peer);
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
    const groupName = `group: ${document.getElementById("group-name").value}`;
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

  const addAttachmentButton = document.getElementById("add-attachment");
  const fileModal = document.getElementById("file-modal");
  const closeFileModal = document.querySelector(".close-file-modal");
  const confirmFileButton = document.getElementById("confirm-file");
  const selectedFilesContainer = document.getElementById("selected-files");

  addAttachmentButton.addEventListener("click", () => {
    fileModal.style.display = "block";
  });

  closeFileModal.addEventListener("click", () => {
    fileModal.style.display = "none";
  });

  window.addEventListener("click", (event) => {
    if (event.target == fileModal) {
      fileModal.style.display = "none";
    }
  });

  confirmFileButton.addEventListener("click", () => {
    const fileInput = document.getElementById("file-input");
    const files = Array.from(fileInput.files);
    selectedFilesContainer.innerHTML = ""; // Clear previous file names
    files.forEach((file) => {
      const fileNameDiv = document.createElement("div");
      fileNameDiv.classList.add("selected-file");
      fileNameDiv.textContent = file.name;

      const removeSpan = document.createElement("span");
      removeSpan.textContent = "x";
      removeSpan.addEventListener("click", () => {
        fileNameDiv.remove();
      });

      fileNameDiv.appendChild(removeSpan);
      selectedFilesContainer.appendChild(fileNameDiv);
    });
    fileModal.style.display = "none";
  });

  const filePreviewModal = document.createElement("div");
  filePreviewModal.id = "file-preview-modal";
  filePreviewModal.classList.add("file-preview-modal");

  const filePreviewContent = document.createElement("div");
  filePreviewContent.id = "file-preview-content";
  filePreviewContent.classList.add("file-preview-content");

  const filePreviewClose = document.createElement("span");
  filePreviewClose.classList.add("file-preview-close");
  filePreviewClose.innerHTML = "&times;";
  filePreviewClose.addEventListener("click", () => {
    filePreviewModal.style.display = "none";
  });

  filePreviewContent.appendChild(filePreviewClose);
  filePreviewModal.appendChild(filePreviewContent);
  document.body.appendChild(filePreviewModal);
});
