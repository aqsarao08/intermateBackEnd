"""
Service for extracting and cleaning job descriptions from images and PDFs.
Removes OCR noise, decorative characters, and irrelevant content.
"""

import re
from typing import Optional

from app.services.pdf_parser import extract_text_with_pdfplumber, extract_text_with_pymupdf
from app.services.parsers import normalize_text


def extract_text_from_image(image_bytes: bytes) -> str:
    """Extract text from image using EasyOCR."""
    try:
        import easyocr
        from PIL import Image
        import io

        # Load image
        image = Image.open(io.BytesIO(image_bytes))

        # Initialize reader (lazy load for better performance)
        reader = easyocr.Reader(["en"], gpu=False)
        results = reader.readtext(image)

        # Extract text from results
        extracted_text = "\n".join([text[1] for text in results])
        return extracted_text.strip()
    except Exception as e:
        raise ValueError(f"Failed to extract text from image: {str(e)}")


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from PDF."""
    try:
        pymupdf_text = normalize_text(extract_text_with_pymupdf(pdf_bytes))
        if pymupdf_text:
            return pymupdf_text

        pdfplumber_text = normalize_text(extract_text_with_pdfplumber(pdf_bytes))
        if pdfplumber_text:
            return pdfplumber_text

        return ""
    except Exception as e:
        raise ValueError(f"Failed to extract text from PDF: {str(e)}")


def clean_job_description(raw_text: str) -> str:
    """
    Clean OCR output to remove noise, symbols, broken words, and irrelevant content.
    Keep only job-relevant information.
    """

    # Step 1: Basic cleanup
    text = raw_text.strip()
    if not text:
        return ""

    # Normalize whitespace and line breaks
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Step 2: Remove common OCR artifacts and garbage patterns
    lines = text.split("\n")
    cleaned_lines = []

    for line in lines:
        line = line.strip()

        # Skip empty lines
        if not line:
            continue

        # Skip pure special character lines (QR codes, decorative lines)
        if re.match(r"^[█▓░▒■□●○◆◇★☆【】『』「」\|▬▲▼▶◀═─═╤╥╦║╝╚╞╟╠╡╢╣╣╤═\-_~*]+$", line):
            continue

        # Skip lines that are mostly non-ASCII symbols/OCR artifacts
        non_ascii_ratio = sum(1 for c in line if ord(c) > 127) / max(len(line), 1)
        if non_ascii_ratio > 0.5:
            continue

        # Skip pure URLs/email patterns (footer content)
        if re.match(r"^(https?://|www\.|[\w\.-]+@[\w\.-]+\.[a-z]+)", line, re.IGNORECASE):
            continue

        # Skip social media handles
        if re.match(r"^[@#][\w\s]+$", line):
            continue

        # Skip lines that are only repeated characters (common OCR errors)
        if re.match(r"^(.)\1{4,}$", line):  # 5+ repeated chars
            continue

        # Skip very short random character sequences
        if len(line) <= 2 and not line.isalnum():
            continue

        # Skip pure number sequences (page numbers, dates that look broken)
        if re.match(r"^\d{10,}$", line):  # Long digit sequences
            continue

        # Skip lines with excessive special characters (not job-related)
        special_char_count = sum(1 for c in line if not c.isalnum() and c not in " (),.-/'&:")
        if len(line) > 10 and special_char_count / len(line) > 0.4:
            continue

        # Remove broken OCR words (words with random letter duplications like "ecnwiz")
        line = fix_common_ocr_errors(line)

        # Remove leading/trailing garbage characters
        line = re.sub(r"^[^\w\(\)]+", "", line)
        line = re.sub(r"[^\w\)\.]$", "", line)

        line = line.strip()
        if line:
            cleaned_lines.append(line)

    # Step 3: Remove duplicate consecutive lines
    final_lines = []
    prev_line = ""
    for line in cleaned_lines:
        if line != prev_line:
            final_lines.append(line)
            prev_line = line

    # Step 4: Merge related content and remove footer patterns
    merged_text = "\n".join(final_lines)

    # Remove common footer patterns
    merged_text = re.sub(r"\n\s*(?:©|®|™|www|http|contact|email|phone).*$", "", merged_text, flags=re.IGNORECASE | re.MULTILINE)

    # Remove repeated brand/logo fragments
    merged_text = remove_logo_noise(merged_text)

    # Step 5: Filter by relevance - keep only job-related sections
    merged_text = filter_job_relevant_content(merged_text)

    return merged_text.strip()


def fix_common_ocr_errors(text: str) -> str:
    """Fix common OCR misrecognitions."""
    # Common patterns: repeated letters, reversed letters, etc.
    replacements = {
        r"\bII\b": "11",  # Roman numeral that should be digits
        r"(?<![\w])O(?=\d)": "0",  # Letter O instead of zero in numbers
        r"l(?=\d)": "1",  # Letter l instead of 1 in numbers
    }

    for pattern, replacement in replacements.items():
        text = re.sub(pattern, replacement, text)

    return text


def remove_logo_noise(text: str) -> str:
    """Remove repeated brand/logo text fragments."""
    lines = text.split("\n")
    line_counts = {}

    # Count line occurrences
    for line in lines:
        line_lower = line.lower().strip()
        if line_lower:
            line_counts[line_lower] = line_counts.get(line_lower, 0) + 1

    # Filter out lines that appear too many times (likely logo/header/footer)
    filtered_lines = []
    for line in lines:
        line_lower = line.lower().strip()
        if line_lower and line_counts.get(line_lower, 0) <= 2:
            filtered_lines.append(line)

    return "\n".join(filtered_lines)


def filter_job_relevant_content(text: str) -> str:
    """
    Keep only job-relevant information.
    Sections: title, qualifications, requirements, experience, location, etc.
    """
    job_keywords = [
        "job",
        "position",
        "role",
        "title",
        "qualification",
        "requirement",
        "skill",
        "experience",
        "education",
        "degree",
        "location",
        "apply",
        "candidate",
        "salary",
        "responsibility",
        "duty",
        "required",
        "preferred",
        "must have",
        "nice to have",
        "age",
        "major",
        "field",
        "deadline",
        "type",
        "contract",
        "eligibility",
    ]

    lines = text.split("\n")
    relevant_lines = []
    current_section_relevant = False

    for line in lines:
        line_lower = line.lower()

        # Check if this line contains job keywords
        has_job_keyword = any(keyword in line_lower for keyword in job_keywords)

        # Keep lines that have job keywords or follow a job keyword section
        if has_job_keyword:
            current_section_relevant = True
            relevant_lines.append(line)
        elif current_section_relevant:
            # Keep non-empty lines in job-relevant sections
            if line.strip() and len(line.strip()) > 3:
                relevant_lines.append(line)
            elif not line.strip():
                # Reset section on empty line after a short gap
                if len(relevant_lines) > 0 and relevant_lines[-1].strip():
                    # Check next few lines to see if there's more job content
                    current_section_relevant = False

    # If we filtered too aggressively, keep at least first 10 non-empty lines
    if len(relevant_lines) < 5:
        non_empty_lines = [line for line in lines if line.strip()]
        relevant_lines = non_empty_lines[:20]

    return "\n".join(relevant_lines)


def extract_and_clean_job_description(file_bytes: bytes, filename: str) -> str:
    """
    Main function to extract and clean job description from image or PDF.
    
    Args:
        file_bytes: Raw file bytes
        filename: Original filename (to detect file type)
        
    Returns:
        Cleaned job description text
    """
    filename_lower = filename.lower()

    # Determine file type and extract text
    if filename_lower.endswith(".pdf"):
        raw_text = extract_text_from_pdf(file_bytes)
    elif filename_lower.endswith((".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp")):
        raw_text = extract_text_from_image(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {filename}. Please upload an image (JPG, PNG) or PDF.")

    if not raw_text:
        raise ValueError("Could not extract any text from the uploaded file.")

    # Clean and return
    cleaned_text = clean_job_description(raw_text)

    if not cleaned_text:
        raise ValueError("The extracted text was too noisy to process. Please try a clearer image or paste the job description manually.")

    return cleaned_text
