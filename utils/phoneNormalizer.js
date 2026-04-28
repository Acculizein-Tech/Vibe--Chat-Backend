const DEFAULT_COUNTRY_CODE = String(process.env.BULK_DEFAULT_COUNTRY_CODE || "91")
  .replace(/\D/g, "")
  .trim() || "91";

export const normalizePhoneNumber = (value, defaultCountryCode = DEFAULT_COUNTRY_CODE) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return { isValid: false, reason: "Missing phone number", e164: "", local: "", countryCode: defaultCountryCode };
  }

  let digits = raw.replace(/\D/g, "");
  if (!digits) {
    return { isValid: false, reason: "No digits found", e164: "", local: "", countryCode: defaultCountryCode };
  }

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  let countryCode = defaultCountryCode;
  let nationalNumber = digits;

  if (digits.length === 10) {
    nationalNumber = digits;
  } else if (digits.length > 10) {
    nationalNumber = digits.slice(-10);
    countryCode = digits.slice(0, digits.length - 10) || defaultCountryCode;
  }

  const normalizedCountry = String(countryCode || "").replace(/\D/g, "") || defaultCountryCode;

  if (!/^\d{10}$/.test(nationalNumber)) {
    return {
      isValid: false,
      reason: "Invalid phone length",
      e164: "",
      local: nationalNumber,
      countryCode: normalizedCountry,
    };
  }

  return {
    isValid: true,
    reason: "",
    e164: `+${normalizedCountry}${nationalNumber}`,
    local: nationalNumber,
    countryCode: normalizedCountry,
  };
};

export const buildPhoneLookupCandidates = (e164, local) => {
  const digits = String(e164 || "").replace(/\D/g, "");
  const localDigits = String(local || "").replace(/\D/g, "");
  const country = digits.length > 10 ? digits.slice(0, digits.length - 10) : "";
  const set = new Set();

  if (digits) {
    set.add(`+${digits}`);
    set.add(digits);
  }

  if (country && localDigits) {
    set.add(`${country}${localDigits}`);
    set.add(`+${country}${localDigits}`);
  }

  if (localDigits) {
    set.add(localDigits);
  }

  return Array.from(set);
};
