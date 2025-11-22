document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const previewContainer = document.getElementById("preview-container");
  const imagePreview = document.getElementById("image-preview");
  const removeImageBtn = document.getElementById("remove-image");
  const progressSection = document.getElementById("progress-section");
  const progressBar = document.getElementById("progress-bar");
  const statusText = document.getElementById("status-text");
  const progressPercent = document.getElementById("progress-percent");
  const resultText = document.getElementById("result-text");
  const copyBtn = document.getElementById("copy-btn");
  const clearBtn = document.getElementById("clear-btn");

  // Drag & Drop handlers
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  });

  // Click to upload
  dropZone.addEventListener("click", (e) => {
    if (e.target !== removeImageBtn) {
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  // Remove image
  removeImageBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    resetUI();
  });

  // Clear button
  clearBtn.addEventListener("click", resetUI);

  // Copy button
  copyBtn.addEventListener("click", () => {
    if (resultText.value) {
      navigator.clipboard.writeText(resultText.value).then(() => {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Copied!
                `;
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
        }, 2000);
      });
    }
  });

  function handleFile(file) {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      previewContainer.classList.remove("hidden");
      // Start OCR
      performOCR(file);
    };
    reader.readAsDataURL(file);
  }

  function performOCR(file) {
    // Reset result
    resultText.value = "";
    copyBtn.disabled = true;
    clearBtn.disabled = true;

    // Show progress
    progressSection.classList.remove("hidden");
    updateProgress(0, "Initializing...");

    Tesseract.recognize(
      file,
      "eng+tha", // Support English and Thai (common for this user context based on request language)
      {
        logger: (m) => {
          if (m.status === "recognizing text") {
            updateProgress(m.progress, "Recognizing text...");
          } else {
            updateProgress(0, m.status);
          }
        },
      }
    )
      .then(({ data: { text } }) => {
        resultText.value = text;
        updateProgress(1, "Completed!");
        copyBtn.disabled = false;
        clearBtn.disabled = false;
        setTimeout(() => {
          progressSection.classList.add("hidden");
        }, 2000);
      })
      .catch((err) => {
        console.error(err);
        statusText.textContent = "Error occurred: " + err.message;
        statusText.style.color = "red";
      });
  }

  function updateProgress(value, status) {
    const percent = Math.round(value * 100);
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    statusText.textContent = status;
    statusText.style.color = "var(--text-secondary)";
  }

  function resetUI() {
    fileInput.value = "";
    previewContainer.classList.add("hidden");
    imagePreview.src = "";
    resultText.value = "";
    progressSection.classList.add("hidden");
    copyBtn.disabled = true;
    clearBtn.disabled = true;
  }
});
