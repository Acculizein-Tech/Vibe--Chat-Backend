import mongoose from "mongoose";
import { Worker } from "bullmq";
import BulkBatch from "../models/BulkBatch.js";
import { BULK_MESSAGE_QUEUE_NAME } from "../queue/bulkQueue.js";
import { redisConnection } from "../queue/redisConnection.js";
import { dispatchBulkMessageToContact } from "../services/bulkMessageService.js";

const WORKER_CONCURRENCY = Number(process.env.BULK_WORKER_CONCURRENCY || 7);
const RATE_LIMIT_PER_SECOND = Number(process.env.BULK_WORKER_RATE_LIMIT || 10);
let lastWorkerErrorLogAt = 0;

const toObjectId = (value) => {
  if (!value || !mongoose.Types.ObjectId.isValid(String(value))) return null;
  return new mongoose.Types.ObjectId(String(value));
};

const maybeMarkBatchCompleted = async (batchId) => {
  const batch = await BulkBatch.findById(batchId)
    .select("total sent failed dispatchStatus")
    .lean();

  if (!batch) return;

  const processed = Number(batch.sent || 0) + Number(batch.failed || 0);
  if (processed < Number(batch.total || 0)) return;

  if (batch.dispatchStatus !== "completed") {
    await BulkBatch.findByIdAndUpdate(batchId, {
      dispatchStatus: "completed",
      completedAt: new Date(),
    });
  }
};

const markContactAsSent = async ({ batchId, contactId, messageId }) => {
  const result = await BulkBatch.updateOne(
    { _id: batchId },
    {
    $set: {
        "contacts.$[contact].status": "sent",
        "contacts.$[contact].sentAt": new Date(),
        "contacts.$[contact].messageId": messageId,
        "contacts.$[contact].error": "",
      dispatchStatus: "processing",
    },
    $inc: {
      sent: 1,
    },
    },
    {
      arrayFilters: [
        {
          "contact._id": contactId,
          "contact.status": { $nin: ["sent", "failed"] },
        },
      ],
    },
  );
  if (!result.modifiedCount) return;
  await maybeMarkBatchCompleted(batchId);
};

const markContactAsFailed = async ({ batchId, contactId, reason }) => {
  const result = await BulkBatch.updateOne(
    { _id: batchId },
    {
    $set: {
        "contacts.$[contact].status": "failed",
        "contacts.$[contact].error": String(reason || "Failed to send message").slice(0, 300),
      dispatchStatus: "processing",
    },
    $inc: {
      failed: 1,
    },
    },
    {
      arrayFilters: [
        {
          "contact._id": contactId,
          "contact.status": { $nin: ["sent", "failed"] },
        },
      ],
    },
  );
  if (!result.modifiedCount) return;
  await maybeMarkBatchCompleted(batchId);
};

export const startBulkMessageWorker = () => {
  const worker = new Worker(
    BULK_MESSAGE_QUEUE_NAME,
    async (job) => {
      const { batchId, contactId, senderId, phone, text, mediaUrl, mediaUrls } = job.data || {};

      const batchObjectId = toObjectId(batchId);
      const contactObjectId = toObjectId(contactId);
      const senderObjectId = toObjectId(senderId);

      if (!batchObjectId || !contactObjectId || !senderObjectId) {
        throw new Error("Invalid job payload");
      }

      const batch = await BulkBatch.findOne({
        _id: batchObjectId,
        userId: senderObjectId,
        contacts: {
          $elemMatch: {
            _id: contactObjectId,
            status: { $in: ["queued", "pending"] },
          },
        },
      })
        .select("_id")
        .lean();

      if (!batch) {
        return { skipped: true };
      }

      const delivered = await dispatchBulkMessageToContact({
        senderId: senderObjectId,
        phone,
        text,
        mediaUrl,
        mediaUrls,
      });

      await markContactAsSent({
        batchId: batchObjectId,
        contactId: contactObjectId,
        messageId: delivered.messageId,
      });

      return {
        messageId: String(delivered.messageId),
      };
    },
    {
      connection: redisConnection,
      concurrency: WORKER_CONCURRENCY,
      limiter: {
        max: RATE_LIMIT_PER_SECOND,
        duration: 1000,
      },
    },
  );

  worker.on("failed", async (job, error) => {
    if (!job) return;

    const attempts = Number(job.opts?.attempts || 1);
    const attemptsMade = Number(job.attemptsMade || 0);
    if (attemptsMade < attempts) {
      return;
    }

    try {
      const batchId = toObjectId(job.data?.batchId);
      const contactId = toObjectId(job.data?.contactId);
      if (!batchId || !contactId) return;
      await markContactAsFailed({
        batchId,
        contactId,
        reason: error?.message || "Delivery failed",
      });
    } catch (err) {
      console.error("Bulk worker failed event update error:", err?.message || err);
    }
  });

  worker.on("error", (error) => {
    const now = Date.now();
    if (now - lastWorkerErrorLogAt < 5000) return;
    lastWorkerErrorLogAt = now;
    console.error("Bulk worker runtime error:", error?.message || error);
  });

  return worker;
};

export default startBulkMessageWorker;
