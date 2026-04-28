import { Readable } from "stream";
import csvParser from "csv-parser";
import { normalizePhoneNumber } from "../utils/phoneNormalizer.js";

const MAX_CONTACTS_HARD_CAP = 5000;
const PHONE_HEADER_ALIASES = new Set([
  "phone",
  "phonenumber",
  "phone_no",
  "phoneno",
  "mobile",
  "mobilenumber",
  "mobile_no",
  "mobilephone",
  "contact",
  "contactnumber",
  "number",
  "whatsapp",
  "whatsappnumber",
]);
const NAME_HEADER_ALIASES = new Set(["name", "fullname", "full_name", "contactname"]);

const normalizeHeader = (header) =>
  String(header || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[-]+/g, "_");

export const parseContactsFromCsvBuffer = async (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("CSV file is empty");
  }

  const contacts = [];
  const invalidRows = [];
  const seenPhones = new Set();

  return new Promise((resolve, reject) => {
    let hasPhoneColumn = false;
    let parserErrored = false;
    let resolvedPhoneHeader = "";
    let resolvedNameHeader = "name";
    let firstHeaderKey = "";

    Readable.from(buffer)
      .pipe(
        csvParser({
          mapHeaders: ({ header }) => normalizeHeader(header),
          skipLines: 0,
          strict: false,
        }),
      )
      .on("headers", (headers = []) => {
        const normalizedHeaders = headers
          .map((h) => normalizeHeader(h))
          .filter(Boolean);
        firstHeaderKey = normalizedHeaders[0] || "";

        resolvedPhoneHeader =
          normalizedHeaders.find((h) => PHONE_HEADER_ALIASES.has(h)) || "";
        resolvedNameHeader =
          normalizedHeaders.find((h) => NAME_HEADER_ALIASES.has(h)) || "name";

        hasPhoneColumn = Boolean(resolvedPhoneHeader);
        if (!hasPhoneColumn) {
          parserErrored = true;
          reject(new Error("CSV must include a 'phone' column"));
        }
      })
      .on("data", (row) => {
        if (parserErrored) return;
        if (contacts.length >= MAX_CONTACTS_HARD_CAP) {
          return;
        }

        // Ignore completely empty CSV rows (common with trailing blank lines).
        const hasAnyValue = Object.values(row || {}).some(
          (value) => String(value || "").trim().length > 0,
        );
        if (!hasAnyValue) {
          return;
        }

        const phoneRaw = String(
          row?.[resolvedPhoneHeader] || row?.phone || row?.[firstHeaderKey] || "",
        ).trim();
        if (!phoneRaw) {
          // Keep UX clean: missing-phone rows are filtered out silently.
          return;
        }

        const name = String(row?.[resolvedNameHeader] || row?.name || "").trim();
        const normalized = normalizePhoneNumber(phoneRaw);

        if (!normalized.isValid) {
          invalidRows.push({ phone: phoneRaw, reason: normalized.reason });
          return;
        }

        if (seenPhones.has(normalized.e164)) {
          invalidRows.push({ phone: phoneRaw, reason: "Duplicate phone in CSV" });
          return;
        }

        seenPhones.add(normalized.e164);
        contacts.push({
          phone: normalized.e164,
          name,
          status: "pending",
          error: "",
        });
      })
      .on("end", () => {
        if (!hasPhoneColumn || parserErrored) {
          return;
        }
        resolve({ contacts, invalidRows });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};
