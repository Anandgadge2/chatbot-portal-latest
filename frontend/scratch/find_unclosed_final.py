
import re

with open(r'd:\Multitenant_chatbot\chatbot_portal-chatbot_flow_features\frontend\src\components\dashboard\DashboardTabPanels.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    # Match <span ... > but not <span ... />
    if re.search(r'<span(?![^>]*/>)', line):
        # Look for closing tag in the same line or subsequent lines
        found = False
        # We need to handle nested spans, so we need a stack-like approach for this specific span
        # But for now, let's just see if ANY </span> exists shortly after
        for j in range(i, min(i + 20, len(lines))):
            if '</span>' in lines[j]:
                found = True
                break
        if not found:
            print(f"MISSING </span> for span at line {i+1}: {line.strip()}")
