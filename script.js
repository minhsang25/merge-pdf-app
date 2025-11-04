const fileInput = document.getElementById("fileInput");
const fileListDiv = document.getElementById("fileList");
const fileInfoDiv = document.getElementById("fileInfo");
const mergeBtn = document.getElementById("mergeBtn");
const addMoreBtn = document.getElementById("addMoreBtn");
const clearBtn = document.getElementById("clearBtn");

let uploadedFiles = [];
let convertedPDFs = new Map(); // Lưu trữ các file PDF đã chuyển đổi

// Ẩn input file và sử dụng nút tùy chỉnh
fileInput.style.display = 'none';
addMoreBtn.addEventListener('click', () => fileInput.click());

function getFileType(file) {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type === 'text/plain') return 'text';
    if (file.type.includes('spreadsheet') || file.type.includes('excel')) return 'excel';
    if (file.type.includes('document') || file.type.includes('word')) return 'word';
    return 'binary';
}

// Tạo phần tử hiển thị trạng thái
function createStatusElement(status, message) {
    const statusElement = document.createElement('span');
    statusElement.className = `status ${status}`;
    statusElement.textContent = message;
    return statusElement;
}

async function convertImageToPDF(file) {
    const img = await createImageBitmap(file);
    const pdf = new window.jspdf.jsPDF();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = img.width;
    const imgHeight = img.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const width = imgWidth * ratio;
    const height = imgHeight * ratio;
    const x = (pdfWidth - width) / 2;
    const y = (pdfHeight - height) / 2;
    
    pdf.addImage(imgData, 'JPEG', x, y, width, height);
    return pdf.output('arraybuffer');
}

async function convertTextToPDF(file) {
    const text = await file.text();
    const pdf = new window.jspdf.jsPDF();
    const lines = pdf.splitTextToSize(text, pdf.internal.pageSize.getWidth() - 20);
    let y = 10;
    const lineHeight = 7;
    
    for (let i = 0; i < lines.length; i++) {
        if (y > pdf.internal.pageSize.getHeight() - 10) {
            pdf.addPage();
            y = 10;
        }
        pdf.text(10, y, lines[i]);
        y += lineHeight;
    }
    
    return pdf.output('arraybuffer');
}

async function convertOfficeFileToPDF(file) {
    return new Promise((resolve, reject) => {
        // Tạo một iframe ẩn để hiển thị và in file
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        // Tạo URL cho file
        const objectUrl = URL.createObjectURL(file);

        // Sử dụng Google Docs Viewer để render file
        const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(objectUrl)}&embedded=true`;
        
        iframe.src = viewerUrl;

        // Đợi iframe load xong
        iframe.onload = async () => {
            try {
                // Sử dụng html2canvas để chụp nội dung đã render
                const canvas = await html2canvas(iframe.contentDocument.body);
                
                // Chuyển canvas thành PDF
                const pdf = new window.jspdf.jsPDF({
                    orientation: 'portrait',
                    unit: 'px',
                    format: [canvas.width, canvas.height]
                });

                // Thêm ảnh vào PDF
                pdf.addImage(
                    canvas.toDataURL('image/jpeg', 1.0),
                    'JPEG',
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

                // Cleanup
                URL.revokeObjectURL(objectUrl);
                document.body.removeChild(iframe);

                resolve(pdf.output('arraybuffer'));
            } catch (error) {
                reject(error);
            }
        };

        // Xử lý lỗi
        iframe.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            document.body.removeChild(iframe);
            reject(new Error('Không thể tải file. Vui lòng thử lại.'));
        };

        // Timeout sau 30 giây
        setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            document.body.removeChild(iframe);
            reject(new Error('Hết thời gian chờ. Vui lòng thử lại.'));
        }, 30000);
    });
}

async function convertExcelToPDF(file) {
    return await convertOfficeFileToPDF(file);
}

async function convertWordToPDF(file) {
    return await convertOfficeFileToPDF(file);
}

async function fileToPDFBuffer(file) {
    if (file.type === 'application/pdf') {
        return await file.arrayBuffer();
    }
    
    const fileType = getFileType(file);
    switch (fileType) {
        case 'image':
            return await convertImageToPDF(file);
        case 'text':
            return await convertTextToPDF(file);
        case 'excel':
            return await convertExcelToPDF(file);
        case 'word':
            return await convertWordToPDF(file);
        default:
            throw new Error(`Không thể chuyển đổi file ${file.name} sang PDF. Định dạng không được hỗ trợ.`);
    }
}

async function convertFile(file, statusElement) {
    try {
        statusElement.className = 'status converting';
        
        const fileType = getFileType(file);
        if (fileType === 'excel' || fileType === 'word') {
            statusElement.textContent = 'Đang chuyển đổi (có thể mất 15-30 giây)...';
        } else {
            statusElement.textContent = 'Đang chuyển đổi...';
        }
        
        const pdfBuffer = await fileToPDFBuffer(file);
        convertedPDFs.set(file.name, pdfBuffer);
        
        statusElement.className = 'status converted';
        statusElement.textContent = 'Đã chuyển đổi thành PDF';
        return true;
    } catch (error) {
        statusElement.className = 'status error';
        statusElement.textContent = 'Lỗi: ' + error.message;
        console.error(`Error converting ${file.name}:`, error);
        return false;
    }
}

function removeFile(index) {
    // Xóa file khỏi danh sách và cache
    const fileName = uploadedFiles[index].name;
    uploadedFiles.splice(index, 1);
    convertedPDFs.delete(fileName);
    
    // Cập nhật giao diện
    renderFileList();
    updateFileInfo();
    mergeBtn.disabled = uploadedFiles.length < 2;
}

clearBtn.addEventListener("click", () => {
    uploadedFiles = [];
    convertedPDFs.clear();
    renderFileList();
    updateFileInfo();
    mergeBtn.disabled = true;
});

fileInput.addEventListener("change", async (e) => {
    const newFiles = Array.from(e.target.files);
    
    // Kiểm tra file trùng lặp
    const duplicates = [];
    const validFiles = newFiles.filter(newFile => {
        const isDuplicate = uploadedFiles.some(existingFile => 
            existingFile.name === newFile.name);
        if (isDuplicate) {
            duplicates.push(newFile.name);
        }
        return !isDuplicate;
    });

    if (duplicates.length > 0) {
        alert(`Các file sau đã tồn tại và sẽ bị bỏ qua:\n${duplicates.join('\n')}`);
    }

    // Thêm các file mới vào danh sách
    uploadedFiles = [...uploadedFiles, ...validFiles];
    mergeBtn.disabled = true; // Vô hiệu hóa nút merge trong quá trình chuyển đổi
    
    // Chỉ render và chuyển đổi các file mới
    renderFileList();
    updateFileInfo();
});

function updateFileInfo() {
    const fileTypes = uploadedFiles.map(file => getFileType(file));
    const typeCount = fileTypes.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});

    fileInfoDiv.innerHTML = `
        <p>Selected files by type:</p>
        ${Object.entries(typeCount)
            .map(([type, count]) => `${type}: ${count} file(s)`)
            .join('<br>')}
    `;
}

function renderFileList() {
    fileListDiv.innerHTML = "";
    const conversionPromises = [];

    uploadedFiles.forEach((file, index) => {
        const div = document.createElement("div");
        div.classList.add("file-item");
        
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `file_${index}`;
        checkbox.checked = true;
        
        const label = document.createElement("label");
        label.htmlFor = `file_${index}`;
        label.textContent = file.name;
        
        const removeBtn = document.createElement("span");
        removeBtn.className = "remove-file";
        removeBtn.textContent = "×";
        removeBtn.title = "Remove file";
        removeBtn.onclick = () => removeFile(index);
        
        let statusElement;
        if (convertedPDFs.has(file.name)) {
            statusElement = createStatusElement('converted', 'Đã chuyển đổi thành PDF');
        } else {
            statusElement = createStatusElement('converting', 'Đang chuẩn bị...');
            // Chỉ chuyển đổi các file chưa được chuyển đổi
            const conversionPromise = convertFile(file, statusElement);
            conversionPromises.push(conversionPromise);
        }
        
        div.appendChild(checkbox);
        div.appendChild(label);
        div.appendChild(statusElement);
        div.appendChild(removeBtn);
        fileListDiv.appendChild(div);

        // Bắt đầu chuyển đổi file
        const conversionPromise = convertFile(file, statusElement);
        conversionPromises.push(conversionPromise);
    });

    // Khi tất cả các file đã được xử lý xong
    Promise.all(conversionPromises).then(results => {
        const allSuccess = results.every(success => success);
        mergeBtn.disabled = !allSuccess || uploadedFiles.length < 2;
    });
}

async function mergePDFs(pdfBuffers) {
    const mergedPdf = await PDFLib.PDFDocument.create();
    for (const buffer of pdfBuffers) {
        const pdf = await PDFLib.PDFDocument.load(buffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
    }
    const mergedBytes = await mergedPdf.save();
    return new Blob([mergedBytes], { type: "application/pdf" });
}

mergeBtn.addEventListener("click", async () => {
    const selectedFiles = uploadedFiles.filter((_, index) =>
        document.getElementById(`file_${index}`).checked
    );

    if (selectedFiles.length < 2) {
        alert("Vui lòng chọn ít nhất 2 file để merge!");
        return;
    }

    try {
        // Hiển thị thông báo đang xử lý
        mergeBtn.disabled = true;
        mergeBtn.textContent = "Đang merge...";
        
        // Lấy các PDF buffer đã được chuyển đổi trước đó
        const pdfBuffers = selectedFiles.map(file => {
            const buffer = convertedPDFs.get(file.name);
            if (!buffer) {
                throw new Error(`File ${file.name} chưa được chuyển đổi thành PDF`);
            }
            return buffer;
        });

        // Merge tất cả các PDF
        const mergedPDFBlob = await mergePDFs(pdfBuffers);

        // Tải file đã merge
        const link = document.createElement("a");
        link.href = URL.createObjectURL(mergedPDFBlob);
        link.download = "merged.pdf";
        link.click();
    } catch (error) {
        console.error('Error:', error);
        alert(error.message || 'Có lỗi xảy ra khi xử lý files. Vui lòng thử lại!');
    } finally {
        // Khôi phục trạng thái nút merge
        mergeBtn.disabled = false;
        mergeBtn.textContent = "Merge Selected Files";
    }
});
