const WebSocket = require("ws");

// Replace this with your server's WebSocket URL
const SERVER_URL = "ws://localhost:8081";

const ws = new WebSocket(SERVER_URL);
let peerId = null;

// When the connection to the signaling server is established
ws.on("open", () => {
  console.log("Connected to signaling server");
});

// Handle incoming messages from the server
ws.on("message", (data) => {
  const message = JSON.parse(data);

  switch (message.type) {
    case "setUsername":
      // Assign the peer's username
      peerId = message.username;
      console.log(`Username set to: ${peerId}`);
      // Send a welcome message to the peer
      ws.send(JSON.stringify({ type: "welcome", id: peerId }));
      break;

    case "groupCreated":
      // Group creation confirmation
      console.log(`Group '${message.groupName}' created successfully.`);
      break;

    case "groupMessage":
      // Handle incoming group messages
      console.log(
        `[Group: ${message.groupName}] ${message.from}: ${message.message}`
      );
      break;

    case "signal":
      // Handle incoming peer-to-peer messages
      console.log(`Message from ${message.from}: ${message.payload.message}`);
      break;

    case "error":
      // Handle errors
      console.error("Error:", message.message);
      break;
  }
});

// Function to send signaling data to another peer
function sendSignal(targetId, payload) {
  ws.send(JSON.stringify({ type: "signal", targetId, payload }));
}

// Clean up when exiting
ws.on("close", () => {
  console.log("Disconnected from signaling server");
});
