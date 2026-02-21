import fetch from "node-fetch";

export const sendPushNotification = async ({
  pushToken,
  title,
  body,
  data,
}) => {
  if (!pushToken) {
    console.log("⚠️ No push token provided");
    return;
  }

  const conversationId = data?.conversationId
    ? String(data.conversationId)
    : null;
  const threadKey = conversationId ? `chat:${conversationId}` : null;

  const payload = {
    to: pushToken,
    sound: "default",
    priority: "high", // ✅ IMPORTANT for Android
    title,
    body,
    data,
    ...(threadKey ? { channelId: "chat-messages" } : {}),
    ...(threadKey ? { threadId: threadKey } : {}),
    ...(threadKey ? { collapseId: threadKey } : {}),
  };

  try {
    console.log("🚀 Sending push payload:", payload);

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    console.log("📬 Expo push response:", result);

    if (result?.data?.status !== "ok") {
      console.log("❌ Push rejected by Expo:", result);
    }
  } catch (err) {
    console.error("❌ Push send failed:", err);
  }
};
