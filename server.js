// server.js
const WebSocket = require("ws");

// Create a WebSocket server on port 8081
const wss = new WebSocket.Server({ port: 8081 });

// Store connected peers (key: username, value: WebSocket object)
const peers = new Map();

// Store groups (key: group name, value: array of usernames)
const groups = new Map();

console.log("Server is running on ws://localhost:8081");

// Handle WebSocket connections
wss.on("connection", (ws) => {
  let username = null;

  console.log("New peer connected, waiting for username...");

  // Handle incoming messages from peers
  ws.on("message", (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case "setUsername":
        // Set the username as the peer's ID
        username = data.username;

        if (peers.has(username)) {
          // If the username is already taken, notify the peer
          ws.send(
            JSON.stringify({ type: "error", message: "Username already taken" })
          );
        } else {
          // Save the peer with its username
          peers.set(username, ws);
          console.log(`Peer registered with username: ${username}`);
          ws.send(JSON.stringify({ type: "welcome", id: username }));
        }
        break;

      case "createGroup":
        // Create a new group with the specified name and members
        const { groupName, members } = data;
        if (groups.has(groupName)) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Group name already exists",
            })
          );
        } else {
          // Add the creator to the group if not already included
          if (!members.includes(username)) {
            members.push(username);
          }
          groups.set(groupName, members);
          console.log(`Group '${groupName}' created with members: ${members}`);
          ws.send(JSON.stringify({ type: "groupCreated", groupName }));
        }
        break;

      case "sendMessageToGroup":
        // Send a message to all members of the specified group
        const { targetGroup, message: groupMessage } = data;
        if (groups.has(targetGroup)) {
          const groupMembers = groups.get(targetGroup);

          // Check if the sender is part of the group
          if (!groupMembers.includes(username)) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "You are not a member of this group",
              })
            );
            return;
          }

          console.log(
            `Message sent to group '${targetGroup}' by '${username}': ${groupMessage}`
          );
          groupMembers.forEach((member) => {
            const memberSocket = peers.get(member);
            if (memberSocket && member !== username) {
              // Exclude sender
              memberSocket.send(
                JSON.stringify({
                  type: "groupMessage",
                  groupName: targetGroup,
                  from: username,
                  message: groupMessage,
                })
              );
            }
          });
        } else {
          ws.send(
            JSON.stringify({ type: "error", message: "Group not found" })
          );
        }
        break;

      case "signal":
        // Forward signaling data to the target peer
        const targetPeer = peers.get(data.targetId);
        if (targetPeer) {
          console.log(
            `Message sent from ${username} to ${data.targetId}:`,
            data.payload.message
          );
          targetPeer.send(
            JSON.stringify({
              type: "signal",
              from: username,
              payload: data.payload,
            })
          );
        } else {
          ws.send(
            JSON.stringify({ type: "error", message: "Target peer not found" })
          );
        }
        break;

      case "disconnect":
        // Handle peer disconnection
        if (username) {
          peers.delete(username);
          console.log(`Peer disconnected: ${username}`);
        }
        break;
    }
  });

  // Handle peer disconnecting
  ws.on("close", () => {
    if (username) {
      peers.delete(username);

      // Remove the peer from all groups
      for (const [groupName, members] of groups.entries()) {
        const index = members.indexOf(username);
        if (index !== -1) {
          members.splice(index, 1);
          if (members.length === 0) {
            // Delete the group if no members are left
            groups.delete(groupName);
            console.log(
              `Group '${groupName}' has been deleted (no members left).`
            );
          }
        }
      }

      console.log(`Peer disconnected: ${username}`);
    }
  });
});
