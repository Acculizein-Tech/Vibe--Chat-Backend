// utils/generateReferralCode.js

export const generateReferralCode = (length = 8) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";

  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
};


//generate code accroidng to superadmin id

// utils/generateNameBasedCode.js
export const generateNameBasedCode = (codename, codelength = 6) => {
  // Validation
  if (!codename || typeof codename !== "string" || codename.trim().length < 2) {
    throw new Error("❌ Codename must be a valid string with at least 2 characters");
  }

  if (isNaN(codelength)) {
    throw new Error("❌ Code length must be a number");
  }
  if (codelength < 4 || codelength > 9) {
    throw new Error("❌ Code length must be between 4 and 9 characters");
  }

  // Prefix length: max 3-6 letters depending on codelength
  const maxPrefixLength = Math.min(6, codelength - 3); // min 3 chars for random part
  const prefix = codename
    .substring(0, maxPrefixLength)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  // Random part length
  const randomPartLength = codelength - prefix.length;
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  if (randomPartLength < 2) {
    throw new Error("❌ Code length too small to include 2 numeric characters");
  }

  let randomPartArray = [];

  // ✅ Add 2 numeric characters first
  for (let i = 0; i < 2; i++) {
    randomPartArray.push(Math.floor(Math.random() * 10).toString());
  }

  // ✅ Fill remaining characters
  for (let i = 2; i < randomPartLength; i++) {
    randomPartArray.push(chars.charAt(Math.floor(Math.random() * chars.length)));
  }

  // ✅ Shuffle randomPartArray
  for (let i = randomPartArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [randomPartArray[i], randomPartArray[j]] = [randomPartArray[j], randomPartArray[i]];
  }

  const randomPart = randomPartArray.join("");

  // Final code
  return `${prefix}${randomPart}`;
};




