// server.js
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const { group } = require("console");

// Create a WebSocket server on port 8081
const wss = new WebSocket.Server({ port: 8081 });

// Store connected peers (key: username, value: WebSocket object)
const peers = new Map();

// Store groups (key: group name, value: array of usernames)
const groups = new Map();

console.log("Server is running on ws://localhost:8081");

function broadcastPeersList() {
  const peersList = JSON.stringify({
    type: "peersList",
    peers: Array.from(peers.keys()),
  });
  peers.forEach((peer) => {
    peer.send(peersList);
  });
}

function notifyGroupMembers(groupName, members) {
  const groupChannelName = groupName;
  members.forEach((member) => {
    const memberSocket = peers.get(member);
    if (memberSocket) {
      memberSocket.send(
        JSON.stringify({
          type: "groupCreated",
          groupName: groupChannelName,
          groupMembers: members,
        })
      );
    }
  });
}

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
          broadcastPeersList(); // Broadcast updated peers list
          ws.send(
            JSON.stringify({
              type: "peersList",
              peers: Array.from(peers.keys()),
            })
          );
          ws.send(JSON.stringify({ type: "welcome", id: username }));
        }
        break;

      case "createGroup":
        // Create a new group with the specified name and members
        console.log(`Creating group with data:`, data);
        const { groupName, selectedPeers } = data;

        //groupName = `group: ${groupName}`; // Prefix group name with "group:"

        console.log(
          `Creating group '${groupName}' with members:`,
          selectedPeers
        );

        if (groups.has(groupName)) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Group name already exists",
            })
          );
        } else {
          // Add the creator to the group if not already included
          if (!selectedPeers.includes(username)) {
            selectedPeers.push(username);
          }
          groups.set(groupName, selectedPeers);
          console.log(
            `Group '${groupName}' created with members: ${selectedPeers}`
          );
          ws.send(JSON.stringify({ type: "groupCreated", groupName }));
          notifyGroupMembers(groupName, selectedPeers); // Notify all group members
        }
        break;

      case "sendMessageToGroup":
        // Send a message to all members of the specified group
        {
          const { target, payload } = data;

          console.log(`target: ${target}, message: ${payload}`);

          if (groups.has(target)) {
            console.log("group exists");

            const groupMembers = groups.get(target);

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
              `Message sent to group '${target}' by '${username}': ${payload}`
            );
            groupMembers.forEach((member) => {
              if (member !== username) {
                const memberSocket = peers.get(member);
                if (memberSocket) {
                  memberSocket.send(
                    JSON.stringify({
                      type: "groupMessage",
                      groupName: target,
                      from: username,
                      message: payload,
                    })
                  );
                }
              }
            });
          } else {
            ws.send(
              JSON.stringify({ type: "error", message: "Group not found" })
            );
          }
        }
        break;

      case "signal":
        // Forward signaling data to the target peer
        console.log(
          `Signal sent from ${username} to ${data.target}:`,
          data.payload
        );
        const targetPeer = peers.get(data.target);
        if (targetPeer) {
          console.log(
            `Message sent from ${username} to ${data.target}:`,
            data.payload
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

      case "getPeers":
        // Send the list of connected peers to the requester
        ws.send(
          JSON.stringify({
            type: "peersList",
            peers: Array.from(peers.keys()),
          })
        );
        break;

      case "requestChat":
        // Forward chat request to the target peer
        const tPeer = peers.get(data.to);
        if (tPeer) {
          console.log(`Chat request from ${username} to ${data.to}`);
          tPeer.send(
            JSON.stringify({
              type: "chatRequest",
              from: username,
            })
          );
        }

        break;

      case "chatMessage":
        // Forward chat message to the target peer
        const target = peers.get(data.to);
        if (target) {
          target.send(
            JSON.stringify({
              type: "chatMessage",
              from: username,
              message: data.message,
            })
          );
        } else {
          ws.send(
            JSON.stringify({ type: "error", message: "Target peer not found" })
          );
        }
        break;

      case "fileTransfer":
        console.log("File transfer request received: ", data);
        {
          const { target, fileName, fileContent } = data;
          const serverDir = path.join(__dirname, "p2pfiles_server");
          const filePath = path.join(serverDir, fileName);

          if (!fs.existsSync(serverDir)) {
            fs.mkdirSync(serverDir);
          }

          fs.writeFileSync(filePath, fileContent, "base64");

          if (peers.has(target)) {
            console.log("Sending file to peer: ", target);
            peers.get(target).send(
              JSON.stringify({
                type: "fileReceived",
                from: username,
                fileName: fileName,
              })
            );
          }
        }
        break;

      case "acceptFile":
        console.log("File acceptance request received: ");
        {
          const { fileName, from } = data;
          const filePath = path.join(__dirname, "p2pfiles_server", fileName);

          if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, "base64");
            if (peers.has(username)) {
              peers.get(username).send(
                JSON.stringify({
                  type: "fileContent",
                  from: from,
                  fileName: fileName,
                  fileContent: fileContent,
                })
              );
            }
          }
        }
        break;

      case "disconnect":
        // Handle peer disconnection
        if (username) {
          peers.delete(username);
          broadcastPeersList(); // Broadcast updated peers list
          console.log(`Peer disconnected: ${username}`);
        }
        break;
    }
  });

  // Handle peer disconnecting
  ws.on("close", () => {
    if (username) {
      // displaying all peers on the server on the console

      console.log("Peers on the server: ", peers.keys());

      peers.delete(username);
      broadcastPeersList(); // Broadcast updated peers list

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
