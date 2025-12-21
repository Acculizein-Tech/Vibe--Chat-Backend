import fetch from "node-fetch";

export const sendPushNotification = async ({
  pushToken,
  title,
  body,
  data,
}) => {
  if (!pushToken) return;

  const payload = {
    to: pushToken,
    sound: "default",
    title,
    body,
    data,
  };

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  console.log("📲 Push sent →", pushToken);
};
