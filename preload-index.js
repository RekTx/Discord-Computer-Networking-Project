const { ipcRenderer } = require("electron");

function showPopup(message) {
  const popup = document.createElement("div");
  popup.className = "popup";
  popup.innerText = message;
  document.body.appendChild(popup);
  setTimeout(() => {
    popup.remove();
  }, 3000);
}

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

  const emailInput = document.getElementById("email");
  const otpInput = document.getElementById("otp");
  const verifyButton = document.getElementById("verify-button");
  const sendOtpButton = document.getElementById("send-otp-button");

  sendOtpButton.addEventListener("click", () => {
    const email = emailInput.value;

    ipcRenderer.invoke("request-otp", email).then((response) => {
      if (response.success) {
        showPopup("OTP sent to your email.");
      } else {
        showPopup("Failed to send OTP. Please try again.");
      }
    });
  });

  verifyButton.addEventListener("click", () => {
    const email = emailInput.value;
    const otp = otpInput.value;

    ipcRenderer.invoke("verify-otp", email, otp).then((response) => {
      if (response.success) {
        showPopup("OTP verified successfully. You can now log in.");
      } else {
        showPopup("Invalid OTP. Please try again.");
      }
    });
  });

  ipcRenderer.on("otp-sent", () => {
    showPopup("OTP sent to your email.");
  });
});
