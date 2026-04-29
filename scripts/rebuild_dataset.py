#!/usr/bin/env python3
"""Rebuild Bible derivative files and optionally import deuterocanonical content.

Usage examples:
  python scripts/rebuild_dataset.py
  python scripts/rebuild_dataset.py --import-deuterocanon
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import urllib.request
import xml.etree.ElementTree as ET
from collections import OrderedDict
from pathlib import Path
from xml.dom import minidom

GUTENBERG_DRB_URL = "https://www.gutenberg.org/ebooks/8300.txt.utf-8"

REQUIRED_CATHOLIC_ENTRIES = {
    "Tobit",
    "Judith",
    "Wisdom of Solomon",
    "Sirach",
    "Baruch",
    "1 Maccabees",
    "2 Maccabees",
    "Additions to Esther",
    "Additions to Daniel",
}

SOURCE_BOOK_MAP = {
    "Tobias": "Tobit",
    "Judith": "Judith",
    "Wisdom": "Wisdom of Solomon",
    "Ecclesiasticus": "Sirach",
    "Baruch": "Baruch",
    "1 Machabees": "1 Maccabees",
    "2 Machabees": "2 Maccabees",
}

CHAPTER_HEADER_RE = re.compile(
    r"^(Tobias|Judith|Esther|Wisdom|Ecclesiasticus|Baruch|Daniel|1 Machabees|2 Machabees) Chapter\s+(\d+)\.?$"
)
SOURCE_VERSE_RE = re.compile(r"^(\d+):(\d+)\.\s*(.*)$")
PROJECT_VERSE_RE = re.compile(r"^(?P<book>.+?)\s+(?P<chapter>\d+):(?P<verse>\d+)\t(?P<text>.+)$")


def slugify(name: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", name.lower().strip())
    return re.sub(r"-+", "-", value).strip("-")


def read_bible_text(path: Path) -> tuple[str, str, list[dict[str, object]]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    if len(lines) < 3:
        raise ValueError("bible.txt is missing expected content.")

    abbreviation = lines[0].strip()
    translation = lines[1].strip()

    verses: list[dict[str, object]] = []
    for line in lines[2:]:
        stripped = line.strip()
        if not stripped:
            continue
        match = PROJECT_VERSE_RE.match(stripped)
        if not match:
            continue
        book = match.group("book").strip()
        chapter = int(match.group("chapter"))
        verse = int(match.group("verse"))
        text = match.group("text").strip()
        verses.append(
            {
                "book": book,
                "chapter": chapter,
                "verse": verse,
                "reference": f"{book} {chapter}:{verse}",
                "text": text,
            }
        )

    return abbreviation, translation, verses


def write_bible_text(path: Path, abbreviation: str, translation: str, verses: list[dict[str, object]]) -> None:
    out_lines = [abbreviation, translation]
    for verse in verses:
        out_lines.append(
            f"{verse['book']} {verse['chapter']}:{verse['verse']}\t{verse['text']}"
        )
    path.write_text("\n".join(out_lines) + "\n", encoding="utf-8")


def fetch_drb_text(cache_path: Path) -> str:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(GUTENBERG_DRB_URL, timeout=60) as response:
        text = response.read().decode("utf-8", errors="ignore")
    cache_path.write_text(text, encoding="utf-8")
    return text


def parse_deuterocanonical_entries(drb_text: str) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    current_source_book: str | None = None
    current_chapter: int | None = None
    last_record: dict[str, object] | None = None

    for raw_line in drb_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        chapter_match = CHAPTER_HEADER_RE.match(line)
        if chapter_match:
            current_source_book = chapter_match.group(1)
            current_chapter = int(chapter_match.group(2))
            last_record = None
            continue

        if current_source_book is None or current_chapter is None:
            continue

        verse_match = SOURCE_VERSE_RE.match(line)
        if verse_match:
            chapter_num = int(verse_match.group(1))
            verse_num = int(verse_match.group(2))
            text = verse_match.group(3).strip()

            out_book: str | None = None
            out_chapter: int | None = None

            if current_source_book in SOURCE_BOOK_MAP:
                out_book = SOURCE_BOOK_MAP[current_source_book]
                out_chapter = chapter_num
            elif current_source_book == "Esther" and 11 <= current_chapter <= 16:
                out_book = "Additions to Esther"
                out_chapter = current_chapter - 10
            elif current_source_book == "Daniel" and 13 <= current_chapter <= 14:
                out_book = "Additions to Daniel"
                out_chapter = current_chapter - 12

            if out_book is None:
                last_record = None
                continue

            record = {
                "book": out_book,
                "chapter": out_chapter,
                "verse": verse_num,
                "reference": f"{out_book} {out_chapter}:{verse_num}",
                "text": text,
            }
            records.append(record)
            last_record = record
            continue

        if last_record is not None and not CHAPTER_HEADER_RE.match(line):
            last_record["text"] = f"{last_record['text']} {line}".strip()

    deduped: list[dict[str, object]] = []
    seen = set()
    for rec in records:
        key = (rec["book"], rec["chapter"], rec["verse"])
        if key in seen:
            continue
        seen.add(key)
        if rec["book"] in REQUIRED_CATHOLIC_ENTRIES and rec["text"]:
            deduped.append(rec)

    return deduped


def merge_deuterocanonical_entries(
    verses: list[dict[str, object]], extras: list[dict[str, object]]
) -> list[dict[str, object]]:
    kept = [v for v in verses if v["book"] not in REQUIRED_CATHOLIC_ENTRIES]
    merged = kept + extras

    # Preserve stable ordering by first appearance of book in existing dataset,
    # while ensuring deuterocanonical entries are grouped correctly by chapter/verse.
    first_seen: OrderedDict[str, int] = OrderedDict()
    for idx, item in enumerate(merged):
        book = str(item["book"])
        if book not in first_seen:
            first_seen[book] = idx

    merged.sort(
        key=lambda v: (
            first_seen[str(v["book"])],
            int(v["chapter"]),
            int(v["verse"]),
        )
    )
    return merged


def write_flat_exports(
    root: Path,
    abbreviation: str,
    translation: str,
    verses: list[dict[str, object]],
) -> None:
    payload = {
        "abbreviation": abbreviation,
        "translation": translation,
        "verse_count": len(verses),
        "verses": verses,
    }

    (root / "bible.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    xml_root = ET.Element(
        "bible",
        {
            "abbreviation": abbreviation,
            "translation": translation,
            "verseCount": str(len(verses)),
        },
    )

    for verse in verses:
        node = ET.SubElement(
            xml_root,
            "verse",
            {
                "book": str(verse["book"]),
                "chapter": str(verse["chapter"]),
                "number": str(verse["verse"]),
                "reference": str(verse["reference"]),
            },
        )
        node.text = str(verse["text"])

    xml_bytes = ET.tostring(xml_root, encoding="utf-8")
    pretty_xml = minidom.parseString(xml_bytes).toprettyxml(indent="  ", encoding="utf-8")
    (root / "bible.xml").write_bytes(pretty_xml)


def write_book_exports(
    root: Path,
    abbreviation: str,
    translation: str,
    verses: list[dict[str, object]],
) -> None:
    books_root = root / "books"
    if books_root.exists():
        shutil.rmtree(books_root)
    books_root.mkdir(parents=True, exist_ok=True)

    grouped: OrderedDict[str, list[dict[str, object]]] = OrderedDict()
    for verse in verses:
        grouped.setdefault(str(verse["book"]), []).append(verse)

    index = {
        "abbreviation": abbreviation,
        "translation": translation,
        "book_count": len(grouped),
        "books": [],
    }

    for book_name, book_verses in grouped.items():
        slug = slugify(book_name)
        book_dir = books_root / slug
        book_dir.mkdir(parents=True, exist_ok=True)

        chapters: OrderedDict[int, list[dict[str, object]]] = OrderedDict()
        for verse in book_verses:
            chapters.setdefault(int(verse["chapter"]), []).append(verse)

        book_payload = {
            "abbreviation": abbreviation,
            "translation": translation,
            "book": book_name,
            "slug": slug,
            "chapter_count": len(chapters),
            "verse_count": len(book_verses),
            "chapters": [
                {
                    "chapter": chapter,
                    "verse_count": len(chapter_verses),
                    "verses": chapter_verses,
                }
                for chapter, chapter_verses in chapters.items()
            ],
        }

        (book_dir / "book.json").write_text(
            json.dumps(book_payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        book_xml = ET.Element(
            "book",
            {
                "name": book_name,
                "slug": slug,
                "chapterCount": str(len(chapters)),
                "verseCount": str(len(book_verses)),
                "translation": translation,
                "abbreviation": abbreviation,
            },
        )

        for chapter, chapter_verses in chapters.items():
            chapter_node = ET.SubElement(
                book_xml,
                "chapter",
                {"number": str(chapter), "verseCount": str(len(chapter_verses))},
            )
            for verse in chapter_verses:
                verse_node = ET.SubElement(
                    chapter_node,
                    "verse",
                    {
                        "number": str(verse["verse"]),
                        "reference": str(verse["reference"]),
                    },
                )
                verse_node.text = str(verse["text"])

        xml_bytes = ET.tostring(book_xml, encoding="utf-8")
        pretty_xml = minidom.parseString(xml_bytes).toprettyxml(indent="  ", encoding="utf-8")
        (book_dir / "book.xml").write_bytes(pretty_xml)

        index["books"].append(
            {
                "name": book_name,
                "slug": slug,
                "chapter_count": len(chapters),
                "verse_count": len(book_verses),
                "json_path": f"books/{slug}/book.json",
                "xml_path": f"books/{slug}/book.xml",
            }
        )

    (books_root / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def sync_books_to_app(root: Path) -> None:
    source = root / "books"
    target = root / "study-guide" / "public" / "books"

    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target)


def main() -> int:
    parser = argparse.ArgumentParser(description="Rebuild Bible dataset artifacts.")
    parser.add_argument(
        "--import-deuterocanon",
        action="store_true",
        help="Import deuterocanonical books and additions from Gutenberg DRB source.",
    )
    parser.add_argument(
        "--source-cache",
        default=".tmp/drb-8300.txt",
        help="Path to cache downloaded DRB text.",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    bible_txt = repo_root / "bible.txt"

    if not bible_txt.exists():
        print("Error: bible.txt not found.", file=sys.stderr)
        return 1

    abbreviation, translation, verses = read_bible_text(bible_txt)

    if args.import_deuterocanon:
        cache_path = repo_root / args.source_cache
        drb_text = fetch_drb_text(cache_path)
        extras = parse_deuterocanonical_entries(drb_text)
        if not extras:
            print("Error: no deuterocanonical entries parsed from source.", file=sys.stderr)
            return 1
        verses = merge_deuterocanonical_entries(verses, extras)
        write_bible_text(bible_txt, abbreviation, translation, verses)

    write_flat_exports(repo_root, abbreviation, translation, verses)
    write_book_exports(repo_root, abbreviation, translation, verses)
    sync_books_to_app(repo_root)

    print(f"Rebuild complete. Books exported: {len({v['book'] for v in verses})}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
