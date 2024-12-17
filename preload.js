const { ipcRenderer } = require("electron");
// const WebSocket = require("ws");
// const ws = new WebSocket("ws://localhost:8081"); // Connect to the signaling server

// Wait for the WebSocket to open
// ws.onopen = () => {
//   console.log("Connected to the server");
// };

// Handle messages from the server
// ws.onmessage = (event) => {
//   const message = JSON.parse(event.data);
//   if (message.type === "welcome") {
//     console.log(`Welcome ${message.id}`);
//   }
// };

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

ipcRenderer.invoke("get-peers").then((peers) => {
  console.log("Peers on the server: ", peers.keys());

  const userList = document.querySelector(".user-list ul");
  userList.innerHTML = "";
  peers.forEach((peer) => {
    const li = document.createElement("li");
    li.textContent = peer;
    userList.appendChild(li);
  });
});
