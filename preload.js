const { ipcRenderer } = require("electron");
const WebSocket = require("ws");
const ws = new WebSocket("ws://localhost:8081"); // Connect to the signaling server

// Wait for the WebSocket to open
ws.onopen = () => {
  console.log("Connected to the server");
};

// Handle messages from the server
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === "welcome") {
    console.log(`Welcome ${message.id}`);
  }
};

window.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = loginForm.elements["username"].value;

    console.log("Form submitted, username:", username);

    if (ws.readyState === WebSocket.OPEN) {
      // Send the username to the WebSocket server
      ws.send(
        JSON.stringify({
          type: "setUsername",
          username: username,
        })
      );
      console.log("Username sent to server");

      // After sending the username, navigate to the chat page
      window.location.href = "chat.html"; // Navigate to chat.html
    } else {
      console.error("WebSocket is not open");
    }

    ipcRenderer.send("login-success", username);
  });
});
