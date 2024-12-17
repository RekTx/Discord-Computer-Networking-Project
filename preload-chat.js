console.log("preload-chat.js loaded");
const { ipcRenderer } = require("electron");

let currentChannel = "";
let currentUsername = ""; // Add this line to define currentUsername

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
  messages.forEach((message, index) => {
    if (message.fileContent) {
    } else {
      const messageDiv = document.createElement("div");
      messageDiv.classList.add("message");
      messageDiv.id = `message-${index}`;

      const usernameSpan = document.createElement("span");
      usernameSpan.classList.add("username");
      usernameSpan.textContent = `${message.from}:`;

      const textSpan = document.createElement("span");
      textSpan.classList.add("text");
      textSpan.textContent = message.text;

      if (message.from === currentUsername) {
        messageDiv.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          showDeletePopup(event, message.text, index);
        });
      }

      messageDiv.appendChild(usernameSpan);
      messageDiv.appendChild(textSpan);
      messagesContainer.appendChild(messageDiv);
    }
  });
  messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to the bottom
}

function updateChatHeader(peer) {
  const chatHeader = document.querySelector(".chat-header h2");
  chatHeader.textContent = `${peer}`;
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

  const cancelButton = document.createElement("button");
  cancelButton.textContent = "Cancel";
  cancelButton.classList.add("file-preview-cancel");
  cancelButton.addEventListener("click", () => {
    filePreviewModal.style.display = "none";
  });

  filePreviewContent.appendChild(saveButton);
  filePreviewContent.appendChild(cancelButton);
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
    const acceptFile = confirm(
      `Do you want to accept the file: ${message.fileName}?`
    );
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

function showWarningPopup(message) {
  const warningPopup = document.getElementById("warning-popup");
  const warningMessage = document.getElementById("warning-message");
  warningMessage.textContent = message;
  warningPopup.style.display = "block";
}

function hideWarningPopup() {
  const warningPopup = document.getElementById("warning-popup");
  warningPopup.style.display = "none";
}

function showEditPopup(event, messageText, messageID) {
  const editPopup = document.getElementById("edit-popup");
  editPopup.style.display = "block";
  editPopup.style.left = `${event.pageX}px`;
  editPopup.style.top = `${event.pageY}px`;

  const editInput = document.getElementById("edit-message-input");
  editInput.value = messageText;

  const saveButton = document.getElementById("save-edit-button");
  saveButton.onclick = () => {
    const newMessageText = editInput.value.trim();
    ipcRenderer.send("edit-message", currentChannel, messageID, newMessageText);
    editPopup.style.display = "none";
  };

  // Close the popup when clicking outside of it
  document.addEventListener(
    "click",
    (e) => {
      if (!editPopup.contains(e.target)) {
        editPopup.style.display = "none";
      }
    },
    { once: true }
  );
}

function showDeletePopup(event, messageText, messageID) {
  const deletePopup = document.getElementById("delete-popup");
  deletePopup.style.display = "block";
  deletePopup.style.left = `${event.pageX}px`;
  deletePopup.style.top = `${event.pageY}px`;

  const deleteButton = document.getElementById("delete-message-button");
  deleteButton.onclick = () => {
    ipcRenderer.send("delete-message", currentChannel, messageText, messageID);
    deletePopup.style.display = "none";
  };

  const editButton = document.getElementById("edit-message-button");
  editButton.onclick = () => {
    showEditPopup(event, messageText, messageID);
    deletePopup.style.display = "none";
  };

  // Close the popup when clicking outside of it
  document.addEventListener(
    "click",
    (e) => {
      if (!deletePopup.contains(e.target)) {
        deletePopup.style.display = "none";
      }
    },
    { once: true }
  );
}

ipcRenderer.on("delete-message", (event, message) => {
  const { target, messageId, from } = message;
  if (currentChannel === from) {
    const messagesContainer = document.getElementById("messages-container");
    const messageDiv = document.getElementById(`message-${messageId}`);
    if (messageDiv) {
      messagesContainer.removeChild(messageDiv);
    }
  }

  // Remove the message from the current channel
  if (currChannels.has(from)) {
    const messages = currChannels.get(from);
    messages.splice(messageId, 1);
    if (currentChannel === from) {
      updateChatMessages(messages);
    }
  }
});

ipcRenderer.on("edit-message", (event, message) => {
  const { target, messageId, from, newMessageText } = message;
  if (currentChannel === from) {
    const messagesContainer = document.getElementById("messages-container");
    const messageDiv = document.getElementById(`message-${messageId}`);
    if (messageDiv) {
      const textSpan = messageDiv.querySelector(".text");
      textSpan.textContent = newMessageText;
    }
  }

  // Update the message in the current channel
  if (currChannels.has(from)) {
    const messages = currChannels.get(from);
    const message = messages[messageId];
    if (message) {
      message.text = newMessageText;
      if (currentChannel === from) {
        updateChatMessages(messages);
      }
    }
  }
});

window.addEventListener("DOMContentLoaded", () => {
  const sendMessageButton = document.getElementById("send-message");
  const messageInput = document.getElementById("message-input");
  const fileInput = document.getElementById("file-input");
  const closeWarningButton = document.getElementById("close-warning");

  if (sendMessageButton) {
    sendMessageButton.addEventListener("click", () => {
      const message = messageInput.value.trim();

      if (!currentChannel) {
        showWarningPopup("No target peer selected.");
        return;
      }

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
          selectedFilesContainer.innerHTML = ""; // Clear selected files container
        };
        reader.readAsDataURL(file);
      } else {
        if (!message) {
          showWarningPopup("Message cannot be empty.");
          return;
        }
        ipcRenderer.send("send-chat-message", message);
      }

      messageInput.value = "";
      fileInput.value = "";
    });
  }

  closeWarningButton.addEventListener("click", hideWarningPopup);

  if (messageInput) {
    messageInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        sendMessageButton.click();
      }
    });
  }

  // setting current-user-username to the current user's username
  ipcRenderer.invoke("get-username").then((username) => {
    currentUsername = username; // Set currentUsername here
    document.getElementById("current-user-username").textContent = username;
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
        updateChatHeader(peer); // Update chat header when switching channels
      });
      chatList.appendChild(channel);
    }
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

    // Switch to the newly created group channel

    //ipcRenderer.send("switch-channel", groupChannelName);
    //updateChatHeader(groupChannelName);
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
