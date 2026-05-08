import fetch from "node-fetch";
import User from "../models/user.js";

const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPT_API = "https://exp.host/--/api/v2/push/getReceipts";
const RECEIPT_LOOKUP_DELAY_MS = 15000;

const isExpoToken = (token) =>
  typeof token === "string" &&
  /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(token.trim());

const clearPushTokenIfMatched = async (token) => {
  try {
    const normalizedToken = String(token || "").trim();
    if (!normalizedToken) return;

    const result = await User.updateOne(
      { pushToken: normalizedToken },
      { $set: { pushToken: null } },
    );

    if (result.modifiedCount > 0) {
      console.log("Cleared invalid push token from user profile");
    }
  } catch (error) {
    console.error("Failed to clear invalid push token:", error);
  }
};

const fetchExpoReceipts = async ({ receiptIds, pushToken }) => {
  try {
    const res = await fetch(EXPO_RECEIPT_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: receiptIds }),
    });

    const result = await res.json();
    const receipts = result?.data || {};

    for (const receiptId of receiptIds) {
      const receipt = receipts?.[receiptId];
      if (!receipt) continue;

      if (receipt.status === "ok") {
        console.log(`Expo receipt ok: ${receiptId}`);
        continue;
      }

      const errorCode = receipt?.details?.error || "UNKNOWN_ERROR";
      console.log("Expo receipt error:", {
        receiptId,
        status: receipt.status,
        message: receipt.message,
        errorCode,
      });

      if (errorCode === "DeviceNotRegistered") {
        await clearPushTokenIfMatched(pushToken);
      }
    }
  } catch (error) {
    console.error("Expo receipt fetch failed:", error);
  }
};

export const sendPushNotification = async ({
  pushToken,
  title,
  body,
  data,
  threadKey,
  subtitle,
}) => {
  if (!pushToken) {
    console.log("No push token provided");
    return;
  }

  const normalizedPushToken = String(pushToken).trim();
  if (!isExpoToken(normalizedPushToken)) {
    console.log("Invalid Expo push token format:", normalizedPushToken);
    await clearPushTokenIfMatched(normalizedPushToken);
    return;
  }

  const conversationId = data?.conversationId
    ? String(data.conversationId)
    : null;
  const resolvedThreadKey =
    String(threadKey || "").trim() || (conversationId ? `chat:${conversationId}` : null);

  const payload = {
    to: normalizedPushToken,
    sound: "default",
    priority: "high",
    title,
    body,
    data,
    ...(subtitle ? { subtitle } : {}),
    ...(resolvedThreadKey ? { channelId: "chat-messages" } : {}),
    ...(resolvedThreadKey ? { threadId: resolvedThreadKey } : {}),
    ...(resolvedThreadKey ? { collapseId: resolvedThreadKey } : {}),
  };

  try {
    console.log("Sending push payload:", payload);

    const res = await fetch(EXPO_PUSH_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    console.log("Expo push response:", result);

    const tickets = Array.isArray(result?.data)
      ? result.data
      : result?.data
        ? [result.data]
        : [];

    const receiptIds = [];

    for (const ticket of tickets) {
      if (!ticket) continue;

      if (ticket.status === "ok" && ticket.id) {
        receiptIds.push(ticket.id);
        continue;
      }

      const errorCode = ticket?.details?.error || "UNKNOWN_ERROR";
      console.log("Push rejected by Expo ticket:", {
        status: ticket?.status,
        message: ticket?.message,
        errorCode,
      });

      if (errorCode === "DeviceNotRegistered") {
        await clearPushTokenIfMatched(normalizedPushToken);
      }
    }

    if (receiptIds.length) {
      setTimeout(() => {
        fetchExpoReceipts({
          receiptIds,
          pushToken: normalizedPushToken,
        });
      }, RECEIPT_LOOKUP_DELAY_MS);
    }
  } catch (err) {
    console.error("Push send failed:", err);
  }
};
