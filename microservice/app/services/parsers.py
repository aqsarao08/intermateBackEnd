import re
from dataclasses import dataclass

from app.services.pdf_parser import (
    extract_text_with_pdfplumber,
    extract_text_with_pymupdf,
)


@dataclass
class ParsedDocument:
    text: str
    parser_used: str


def normalize_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_pdf_bytes(file_bytes: bytes) -> ParsedDocument:
    pymupdf_text = normalize_text(extract_text_with_pymupdf(file_bytes))
    if pymupdf_text:
        return ParsedDocument(text=pymupdf_text, parser_used="pymupdf")

    pdfplumber_text = normalize_text(extract_text_with_pdfplumber(file_bytes))
    if pdfplumber_text:
        return ParsedDocument(text=pdfplumber_text, parser_used="pdfplumber")

    return ParsedDocument(text="", parser_used="none")
