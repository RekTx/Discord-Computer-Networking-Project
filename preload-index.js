const { ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = loginForm.elements["username"].value;

    ipcRenderer.invoke("send-username", username).then((response) => {
      if (response.success) {
        window.location.href = "chat.html";
      } else {
        console.error("WebSocket is not open");
      }
    });

    ipcRenderer.send("login-success", username);
  });
});
