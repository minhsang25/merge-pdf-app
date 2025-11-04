from flask import Flask, render_template, request, send_file
from PyPDF2 import PdfMerger
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/", methods=["GET", "POST"])
def index():
    merged_file = None
    if request.method == "POST":
        files = request.files.getlist("pdf_files")
        merger = PdfMerger()
        filenames = []

        for file in files:
            if file.filename.endswith(".pdf"):
                filename = secure_filename(file.filename)
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                file.save(filepath)
                filenames.append(filepath)
                merger.append(filepath)

        merged_path = os.path.join(UPLOAD_FOLDER, "merged.pdf")
        merger.write(merged_path)
        merger.close()

        # Xóa file tạm sau khi merge (trừ file merged)
        for f in filenames:
            os.remove(f)

        return send_file(merged_path, as_attachment=True)

    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True)
