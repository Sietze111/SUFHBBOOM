const MAX_SIZE_MB = 25;
const worker = new Worker(new URL("./validator.worker.js", import.meta.url), {
  type: "module",
});

const dropPanel = document.getElementById("drop-panel");
const fileInput = document.getElementById("file-input");
const status = document.getElementById("status");
const resultCard = document.getElementById("result-card");
const resultTitle = document.getElementById("result-title");
const resultFile = document.getElementById("result-file");
const summaryBlock = document.getElementById("summary-block");
const rawDetails = document.getElementById("raw-details");
const rawErrors = document.getElementById("raw-errors");

function setStatus(message) {
  status.textContent = message;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderResult(result) {
  resultCard.hidden = false;
  resultFile.textContent = result.fileName;

  if (result.valid) {
    resultTitle.textContent = "Bestand is geldig";
    summaryBlock.innerHTML = [
      '<p class="badge badge-ok">Geen validatiefouten gevonden</p>',
      "<p>Het bestand voldoet aan alle SUF-schemaregels.</p>",
    ].join("");

    rawDetails.hidden = true;
    rawErrors.textContent = "";
    return;
  }

  resultTitle.textContent = "Bestand heeft validatiefouten";
  const topErrors = result.groupedErrors.slice(0, 120);

  const listItems = topErrors
    .map((entry) => {
      const suffix = entry.count > 1 ? ` (x${entry.count})` : "";
      return `<li>${escapeHtml(entry.message + suffix)}</li>`;
    })
    .join("");

  const moreInfo =
    result.groupedErrors.length > topErrors.length
      ? `<p>... en nog ${result.groupedErrors.length - topErrors.length} foutpatronen.</p>`
      : "";

  summaryBlock.innerHTML = [
    `<p class="badge badge-error">${result.errorCount} fout(en) gevonden</p>`,
    "<p>Samenvatting per uniek foutpatroon:</p>",
    `<ul class="error-list">${listItems}</ul>`,
    moreInfo,
  ].join("");

  rawDetails.hidden = false;
  rawErrors.textContent = JSON.stringify(result.rawErrors, null, 2);
}

async function handleFile(file) {
  if (!file) {
    return;
  }

  const maxBytes = MAX_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    setStatus(
      `Bestand te groot: ${file.name} is groter dan ${MAX_SIZE_MB} MB.`,
    );
    return;
  }

  setStatus(`Lezen en valideren: ${file.name}...`);

  try {
    const text = await file.text();
    worker.postMessage({
      type: "validateText",
      payload: {
        fileName: file.name,
        text,
      },
    });
  } catch (error) {
    setStatus(`Bestand kon niet worden gelezen: ${error.message}`);
  }
}

worker.onmessage = (event) => {
  const { type, payload } = event.data || {};

  if (type !== "result") {
    return;
  }

  if (payload.valid) {
    setStatus(`Klaar: ${payload.fileName} is geldig.`);
  } else if (payload.parseError) {
    setStatus(`Klaar: JSON parse error in ${payload.fileName}.`);
  } else {
    setStatus(
      `Klaar: ${payload.errorCount} validatiefouten in ${payload.fileName}.`,
    );
  }

  renderResult(payload);
};

worker.onerror = (event) => {
  setStatus(`Validatie-engine fout: ${event.message}`);
};

worker.onmessageerror = () => {
  setStatus("Validatie-engine kon antwoord niet verwerken.");
};

fileInput.addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  handleFile(file);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropPanel.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropPanel.classList.add("is-over");
  });
});

["dragleave", "dragend", "drop"].forEach((eventName) => {
  dropPanel.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropPanel.classList.remove("is-over");
  });
});

dropPanel.addEventListener("drop", (event) => {
  const file =
    event.dataTransfer &&
    event.dataTransfer.files &&
    event.dataTransfer.files[0];
  handleFile(file);
});
