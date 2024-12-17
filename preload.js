const { ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = loginForm.elements["username"].value;

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
});

const userList = document.querySelector(".user-list ul");
function updatePeersList(peers) {
  userList.innerHTML = "";
  peers.forEach((peer) => {
    const li = document.createElement("li");
    li.textContent = peer;

    const chatButton = document.createElement("button");
    chatButton.textContent = "Chat";
    chatButton.classList.add("chat-button");
    chatButton.setAttribute("data-peer", peer);

    chatButton.addEventListener("click", () => {
      console.log(`Chatting with peer: ${peer}`);
    });

    li.appendChild(chatButton);
    userList.appendChild(li);
  });
}

ipcRenderer.invoke("get-peers").then((peers) => {
  console.log("Peers on the server: ", peers.keys());
  updatePeersList(peers);
});

// Listen for updates to the peers list
ipcRenderer.on("update-peers", (event, peers) => {
  updatePeersList(peers);
});
