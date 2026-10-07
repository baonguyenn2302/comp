import re
from collections import defaultdict

def analyze():
    files = ["topic/vcx.md", "topic/vhm.md", "topic/vkq.md"]
    all_qs = []
    
    for path in files:
        topic_name = path.replace("topic/", "").replace(".md", "")
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        current_q = None
        for i, raw_line in enumerate(lines, 1):
            line = raw_line.strip()
            if not line:
                continue
            
            # match Question heading
            m = re.match(r'^(?:\[!b:[^\]]*\])?\s*Câu\s+(\d+)[:\.]\s*(.*)$', line)
            if m:
                if current_q:
                    all_qs.append(current_q)
                current_q = {
                    "topic": topic_name,
                    "path": path,
                    "num": int(m.group(1)),
                    "raw_title": line,
                    "text": m.group(2).strip(),
                    "options": [],
                    "line": i
                }
            elif current_q is not None:
                opt_m = re.match(r'^(\*?)([A-Da-d])[\.\)]\s*(.*)$', line)
                if opt_m:
                    current_q["options"].append({
                        "is_correct": bool(opt_m.group(1)),
                        "letter": opt_m.group(2).upper(),
                        "text": opt_m.group(3).strip(),
                        "raw": line
                    })
                else:
                    if current_q["options"]:
                        current_q["options"][-1]["text"] += " " + line
                    else:
                        current_q["text"] += " " + line
        if current_q:
            all_qs.append(current_q)
            
    print(f"Total parsed questions: {len(all_qs)}")
    
    # Check by topic
    for topic in ["vcx", "vhm", "vkq"]:
        topic_qs = [q for q in all_qs if q["topic"] == topic]
        print(f"\n--- Topic: {topic} (Total: {len(topic_qs)}) ---")
        valid_qs = []
        invalid_qs = []
        for q in topic_qs:
            corrects = [opt for opt in q["options"] if opt["is_correct"]]
            reasons = []
            if len(q["options"]) < 2:
                reasons.append(f"Chỉ có {len(q['options'])} lựa chọn")
            if len(corrects) == 0:
                reasons.append("Không có đáp án đúng (*)")
            elif len(corrects) > 1:
                reasons.append(f"Có {len(corrects)} đáp án đúng")
            if not q["text"]:
                reasons.append("Nội dung câu hỏi rỗng")
                
            if reasons:
                invalid_qs.append((q, reasons))
            else:
                valid_qs.append(q)
                
        print(f"Valid: {len(valid_qs)}, Invalid: {len(invalid_qs)}")
        for q, reasons in invalid_qs:
            print(f"  [INVALID] Q{q['num']} (line {q['line']}): {', '.join(reasons)} | Text: {q['text'][:50]}")

    # Check duplicate questions across or within topics
    text_map = defaultdict(list)
    for q in all_qs:
        clean_t = re.sub(r'\[!b:\$?\s*|\$?\s*\]', '', q['text']).strip().lower()
        clean_t = re.sub(r'[.,:;?!]+$', '', clean_t).strip()
        clean_t = re.sub(r'\s+', ' ', clean_t)
        text_map[clean_t].append(q)

    dups = {k: v for k, v in text_map.items() if len(v) > 1}
    print(f"\nTotal duplicate text groups: {len(dups)}")

    for topic in ["vcx", "vhm", "vkq"]:
        topic_qs = [q for q in all_qs if q["topic"] == topic]
        valid_qs = []
        for q in topic_qs:
            corrects = [opt for opt in q["options"] if opt["is_correct"]]
            if len(q["options"]) >= 2 and len(corrects) == 1 and q["text"].strip():
                valid_qs.append(q)
        
        seen = set()
        unique_valid = []
        for q in valid_qs:
            ct = re.sub(r'\[!b:\$?\s*|\$?\s*\]', '', q['text']).strip().lower()
            ct = re.sub(r'[.,:;?!]+$', '', ct).strip()
            ct = re.sub(r'\s+', ' ', ct)
            if ct not in seen:
                seen.add(ct)
                unique_valid.append(q)
        print(f"Topic {topic}: total parsed={len(topic_qs)}, valid={len(valid_qs)}, unique valid={len(unique_valid)}")

    # Check position-dependent options like "Cả A và B", "Tất cả các đáp án", "Cả 3 phương án", etc.
    pos_dependent_regex = re.compile(r'(cả\s+[a-d]\s+và\s+[a-d]|tất cả|cả [23]|tất cả các phương án|không có phương án nào|cả hai|cả ba)', re.IGNORECASE)
    pos_qs = []
    for q in all_qs:
        for opt in q["options"]:
            if pos_dependent_regex.search(opt["text"]):
                pos_qs.append((q, opt))
                break
    print(f"\nQuestions with position-dependent or umbrella options: {len(pos_qs)}")
    for q, opt in pos_qs[:10]:
        print(f"  [{q['topic']} Q{q['num']}] Opt ({opt['letter']}{'*' if opt['is_correct'] else ''}): {opt['text']}")


if __name__ == "__main__":
    analyze()
