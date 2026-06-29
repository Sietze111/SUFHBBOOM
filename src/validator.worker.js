import {
  createBrowserValidator,
  validateDataWith,
} from "./browser-validator.js";

let validateFn;

function ensureValidator() {
  if (!validateFn) {
    validateFn = createBrowserValidator();
  }
  return validateFn;
}

self.onmessage = async (event) => {
  const { type, payload } = event.data || {};

  if (type !== "validateText") {
    return;
  }

  const { fileName, text } = payload;

  try {
    const parsed = JSON.parse(text);
    const result = validateDataWith(ensureValidator(), parsed);

    self.postMessage({
      type: "result",
      payload: {
        fileName,
        parseError: null,
        ...result,
      },
    });
  } catch (error) {
    self.postMessage({
      type: "result",
      payload: {
        fileName,
        valid: false,
        errorCount: 1,
        groupedErrors: [
          {
            message: `JSON parse error: ${error.message}`,
            count: 1,
          },
        ],
        rawErrors: [],
        parseError: error.message,
      },
    });
  }
};
