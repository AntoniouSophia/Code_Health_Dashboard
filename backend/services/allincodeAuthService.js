// services/allincodeAuthService.js

const config = require("../config.js");

async function loginToAllinCode() {
  const body = new URLSearchParams();

  body.append("email", config.allincodeEmail);
  body.append("password", config.allincodePassword);

  const response = await fetch(`${config.allincodeBaseUrl}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AllinCode login failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  return {
    accessToken: data.accessToken || data.access_token || data.access,
    refreshToken: data.refreshToken || data.refresh_token || data.refresh,
    raw: data
  };
}

module.exports = {
  loginToAllinCode
};