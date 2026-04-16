from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import get_settings
from app.models.schemas import AnalyzeResponse, AnalyzeTextRequest
from app.services.analyzer import analyze_resume_against_jd
from app.services.parsers import parse_pdf_bytes

router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    resume_file: UploadFile = File(...),
    jd_file: Optional[UploadFile] = File(default=None),
    jd_text: str = Form(default=""),
):
    settings = get_settings()

    resume_bytes = await resume_file.read()
    resume_doc = parse_pdf_bytes(resume_bytes)
    if len(resume_doc.text) < settings.min_text_length:
        raise HTTPException(status_code=422, detail="Resume PDF did not produce enough text")

    resolved_jd_text = (jd_text or "").strip()
    jd_parser_used = "text"
    if jd_file is not None:
        jd_bytes = await jd_file.read()
        jd_doc = parse_pdf_bytes(jd_bytes)
        resolved_jd_text = jd_doc.text
        jd_parser_used = jd_doc.parser_used

    if len(resolved_jd_text) < settings.min_text_length:
        raise HTTPException(status_code=422, detail="Provide a JD PDF or enough pasted JD text")

    return analyze_resume_against_jd(
        resume_text=resume_doc.text,
        jd_text=resolved_jd_text,
        parser_used=resume_doc.parser_used,
        jd_parser_used=jd_parser_used,
    )


@router.post("/analyze/text", response_model=AnalyzeResponse)
async def analyze_text(payload: AnalyzeTextRequest):
    settings = get_settings()

    if len(payload.resume_text.strip()) < settings.min_text_length:
      raise HTTPException(status_code=422, detail="Resume text did not produce enough content")

    if len(payload.jd_text.strip()) < settings.min_text_length:
      raise HTTPException(status_code=422, detail="Provide enough JD text for analysis")

    return analyze_resume_against_jd(
        resume_text=payload.resume_text.strip(),
        jd_text=payload.jd_text.strip(),
        parser_used="stored_text",
        jd_parser_used="stored_text",
    )
