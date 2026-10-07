"""
Synchronizes markdown files in topic/ into js/topic_data.js
This allows the app to work seamlessly both via HTTP server and directly via file:// URL.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOPIC_DIR = ROOT / "topic"
OUTPUT_FILE = ROOT / "js" / "topic_data.js"

TOPICS = [
    {"id": "vcx", "title": "Chủ nghĩa xã hội khoa học (VCX)", "file": "vcx.md"},
    {"id": "vhm", "title": "Triết học Mác - Lênin (VHM)", "file": "vhm.md"},
    {"id": "vkq", "title": "Kinh tế chính trị Mác - Lênin (VKQ)", "file": "vkq.md"}
]

def sync():
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    bank_data = {}
    for t in TOPICS:
        file_path = TOPIC_DIR / t["file"]
        if not file_path.exists():
            raise FileNotFoundError(f"Missing topic file: {file_path}")
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        bank_data[t["id"]] = {
            "id": t["id"],
            "title": t["title"],
            "fileName": t["file"],
            "rawMarkdown": content
        }
    
    js_content = f"// System generated raw topic data fallback for offline/file:// protocol support\n"
    js_content += f"(typeof window !== 'undefined' ? window : globalThis).RAW_TOPIC_DATA = {json.dumps(bank_data, ensure_ascii=False, indent=2)};\n"
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"Successfully synced topic markdown files to {OUTPUT_FILE}")

if __name__ == "__main__":
    sync()
