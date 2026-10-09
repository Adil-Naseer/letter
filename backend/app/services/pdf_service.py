import re
from pathlib import Path
from pypdf import PdfReader


CHAPTER_RE = re.compile(r"^(chapter|unit|lesson)\s+\d+[:\-. ]?.*", re.IGNORECASE)


def extract_pdf(path: Path) -> list[dict]:
    reader = PdfReader(str(path))
    pages: list[dict] = []
    for idx, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        pages.append({"page": idx, "text": text})
    return pages


def detect_chapters(pages: list[dict]) -> list[dict]:
    chapters: list[dict] = []
    for page in pages:
        lines = [ln.strip() for ln in page["text"].splitlines() if ln.strip()]
        heading = next((ln for ln in lines[:8] if CHAPTER_RE.match(ln)), None)
        if heading:
            chapters.append({"title": heading[:255], "page_start": page["page"]})
    if not chapters:
        chapters = [{"title": "General Content", "page_start": 1}]
    return chapters


def chunk_text(page_text: str, max_chars: int = 1200) -> list[str]:
    clean = " ".join(page_text.split())
    if not clean:
        return []
    chunks = []
    while clean:
        chunk = clean[:max_chars]
        split = chunk.rfind(". ")
        if split > 200:
            chunk = chunk[: split + 1]
        chunks.append(chunk.strip())
        clean = clean[len(chunk):].strip()
    return chunks
