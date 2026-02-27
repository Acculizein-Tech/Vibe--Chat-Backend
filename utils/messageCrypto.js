import crypto from "crypto";
import Conversation from "../models/Conversation.js";
import GroupConversation from "../models/GroupConversation.js";

const ENC_ALGO = "aes-256-gcm";
const KEY_BYTES = 32;
const DEFAULT_MASTER_SEED = "ryngales-dev-master-key-change-in-production";

const toBase64 = (buf) => Buffer.from(buf).toString("base64");
const fromBase64 = (val) => Buffer.from(String(val || ""), "base64");

const stripMessageCryptoFields = (msg) => {
  if (!msg || typeof msg !== "object") return msg;
  delete msg.encryptedText;
  delete msg.textIv;
  delete msg.textAuthTag;
  delete msg.textAlg;
  delete msg.encryptionVersion;
  return msg;
};

const getMasterKey = () => {
  const seed =
    process.env.MESSAGE_MASTER_KEY ||
    process.env.CHAT_MASTER_KEY ||
    DEFAULT_MASTER_SEED;
  if (/^[a-f0-9]{64}$/i.test(seed)) {
    return Buffer.from(seed, "hex");
  }
  try {
    const asBase64 = Buffer.from(seed, "base64");
    if (asBase64.length === KEY_BYTES) return asBase64;
  } catch (_err) {
    // ignore and derive from hash
  }
  return crypto.createHash("sha256").update(seed).digest();
};

const encryptWithKey = (plainText, key) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plainText || ""), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    encryptedText: toBase64(encrypted),
    textIv: toBase64(iv),
    textAuthTag: toBase64(tag),
    textAlg: ENC_ALGO,
    encryptionVersion: 1,
    isEncrypted: true,
  };
};

const decryptWithKey = ({ encryptedText, textIv, textAuthTag }, key) => {
  const decipher = crypto.createDecipheriv(ENC_ALGO, key, fromBase64(textIv));
  decipher.setAuthTag(fromBase64(textAuthTag));
  const plain = Buffer.concat([
    decipher.update(fromBase64(encryptedText)),
    decipher.final(),
  ]);
  return plain.toString("utf8");
};

const decryptConversationKey = (encryption) => {
  if (
    !encryption?.keyCiphertext ||
    !encryption?.keyIv ||
    !encryption?.keyAuthTag
  ) {
    return null;
  }
  return decryptWithKey(
    {
      encryptedText: encryption.keyCiphertext,
      textIv: encryption.keyIv,
      textAuthTag: encryption.keyAuthTag,
    },
    getMasterKey(),
  );
};

const resolveConversationForEncryption = async (conversationId) => {
  const directConversation = await Conversation.findById(conversationId)
    .select("encryption")
    .lean();
  if (directConversation) {
    return { source: "direct", conversation: directConversation };
  }

  const groupConversation = await GroupConversation.findById(conversationId)
    .select("encryption")
    .lean();
  if (groupConversation) {
    return { source: "group", conversation: groupConversation };
  }

  return null;
};

const saveConversationEncryption = async (conversationId, source, payload) => {
  const Model = source === "group" ? GroupConversation : Conversation;
  await Model.findByIdAndUpdate(conversationId, {
    $set: {
      encryption: {
        enabled: true,
        keyCiphertext: payload.encryptedText,
        keyIv: payload.textIv,
        keyAuthTag: payload.textAuthTag,
        keyAlg: ENC_ALGO,
        keyVersion: 1,
      },
    },
  });
};

export const getOrCreateConversationDataKey = async (
  conversationId,
  cache = null,
) => {
  const cacheKey = String(conversationId || "");
  if (!cacheKey) return null;
  if (cache?.has(cacheKey)) return cache.get(cacheKey);

  const resolved = await resolveConversationForEncryption(conversationId);
  if (!resolved?.conversation) return null;

  const { conversation, source } = resolved;

  let dataKey = null;
  let existing = null;
  try {
    existing = decryptConversationKey(conversation.encryption);
  } catch (_err) {
    existing = null;
  }
  if (existing) {
    const decoded = Buffer.from(existing, "base64");
    if (decoded.length === KEY_BYTES) {
      dataKey = decoded;
    }
  }
  if (!dataKey) {
    dataKey = crypto.randomBytes(KEY_BYTES);
    const wrapped = encryptWithKey(toBase64(dataKey), getMasterKey());
    await saveConversationEncryption(conversationId, source, wrapped);
  }

  if (cache) cache.set(cacheKey, dataKey);
  return dataKey;
};

export const encryptMessageText = async ({
  conversationId,
  text,
  cache = null,
}) => {
  const value = String(text || "");
  if (!value) {
    return {
      text: "",
      isEncrypted: false,
      encryptedText: "",
      textIv: "",
      textAuthTag: "",
      textAlg: ENC_ALGO,
      encryptionVersion: 1,
    };
  }

  const key = await getOrCreateConversationDataKey(conversationId, cache);
  if (!key) {
    return {
      text: value,
      isEncrypted: false,
      encryptedText: "",
      textIv: "",
      textAuthTag: "",
      textAlg: ENC_ALGO,
      encryptionVersion: 1,
    };
  }

  return {
    text: "",
    ...encryptWithKey(value, key),
  };
};

export const decryptMessageText = async (message, cache = null) => {
  if (!message) return "";
  if (
    message.isEncrypted &&
    message.encryptedText &&
    message.textIv &&
    message.textAuthTag
  ) {
    try {
      const key = await getOrCreateConversationDataKey(
        message.conversationId,
        cache,
      );
      if (!key) return String(message.text || "");
      return decryptWithKey(message, key);
    } catch (err) {
      console.error("decryptMessageText failed:", err?.message || err);
      return String(message.text || "");
    }
  }
  return String(message.text || "");
};

export const materializeMessageForClient = async (message, cache = null) => {
  const plainText = await decryptMessageText(message, cache);
  const base = message?.toObject ? message.toObject() : { ...message };
  base.text = plainText;
  return stripMessageCryptoFields(base);
};
