import dotenv from "dotenv";
import connectDB from "../config/db.js";
import { startBulkMessageWorker } from "./bulkMessageWorker.js";

dotenv.config();

await connectDB();

startBulkMessageWorker();
console.log("Bulk message worker started");
