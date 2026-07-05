import os
import sys

try:
    import PyPDF2
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "PyPDF2"])
    import PyPDF2

def extract_pdf(pdf_path, output_path):
    try:
        reader = PyPDF2.PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"Extracted {pdf_path} to {output_path}")
    except Exception as e:
        print(f"Failed to extract {pdf_path}: {e}")

if __name__ == "__main__":
    extract_pdf("d:\\SmartPastureAPP\\SmartPasture_Master_File.pdf", "d:\\SmartPastureAPP\\master.txt")
    extract_pdf("d:\\SmartPastureAPP\\Sensator.pdf", "d:\\SmartPastureAPP\\sensator.txt")
