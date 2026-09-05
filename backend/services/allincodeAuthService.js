// services/allincodeAuthService.js

async function loginToAllinCode() {
  const body = new URLSearchParams();

  body.append("email", process.env.ALLINCODE_EMAIL);
  body.append("password", process.env.ALLINCODE_PASSWORD);

  const response = await fetch(`${process.env.ALLINCODE_BASE_URL}/login`, {
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