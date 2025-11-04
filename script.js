const fileInput = document.getElementById("pdfFiles");
const fileListDiv = document.getElementById("fileList");
const mergeBtn = document.getElementById("mergeBtn");

let uploadedFiles = [];

fileInput.addEventListener("change", (e) => {
  uploadedFiles = Array.from(e.target.files);
  renderFileList();
});

function renderFileList() {
  fileListDiv.innerHTML = "";
  uploadedFiles.forEach((file, index) => {
    const div = document.createElement("div");
    div.classList.add("file-item");
    div.innerHTML = `
      <input type="checkbox" id="file_${index}" checked>
      <label for="file_${index}">${file.name}</label>
    `;
    fileListDiv.appendChild(div);
  });
}

mergeBtn.addEventListener("click", async () => {
  const selectedFiles = uploadedFiles.filter((_, index) =>
    document.getElementById(`file_${index}`).checked
  );

  if (selectedFiles.length < 2) {
    alert("Vui lòng chọn ít nhất 2 file PDF để merge!");
    return;
  }

  const mergedPdf = await PDFLib.PDFDocument.create();

  for (const file of selectedFiles) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedBytes = await mergedPdf.save();
  const blob = new Blob([mergedBytes], { type: "application/pdf" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "merged.pdf";
  link.click();
});
