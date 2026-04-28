import { Queue } from "bullmq";
import { redisConnection } from "./redisConnection.js";

export const BULK_MESSAGE_QUEUE_NAME = "bulk-message-jobs";

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "fixed",
    delay: Number(process.env.BULK_JOB_RETRY_DELAY_MS || 5000),
  },
  removeOnComplete: {
    age: 60 * 60 * 24,
    count: 5000,
  },
  removeOnFail: {
    age: 60 * 60 * 24 * 7,
    count: 5000,
  },
};

let bulkMessageQueue = null;

export const getBulkMessageQueue = () => {
  if (bulkMessageQueue) return bulkMessageQueue;
  bulkMessageQueue = new Queue(BULK_MESSAGE_QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions,
  });
  return bulkMessageQueue;
};
