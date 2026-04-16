from io import BytesIO

import fitz
import pdfplumber
from fastapi import UploadFile


def extract_text_with_pdfplumber(file_bytes: bytes) -> str:
    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages).strip()


def extract_text_with_pymupdf(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = [page.get_text("text") for page in doc]
    return "\n".join(pages).strip()


def extract_text_from_upload(upload: UploadFile) -> str:
    file_bytes = upload.file.read()
    upload.file.seek(0)

    text = extract_text_with_pdfplumber(file_bytes)
    if text.strip():
        return text

    text = extract_text_with_pymupdf(file_bytes)
    if text.strip():
        return text

    return ""
