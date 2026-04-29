
import re

with open(r'd:\Multitenant_chatbot\chatbot_portal-chatbot_flow_features\frontend\src\components\dashboard\DashboardTabPanels.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    opens = len(re.findall(r'<span(?![^>]*/>)', line))
    closes = len(re.findall(r'</span>', line))
    if opens > closes:
        # Check if it's closed in the next 5 lines
        found = False
        for j in range(i + 1, min(i + 6, len(lines))):
            if '</span>' in lines[j]:
                found = True
                break
        if not found:
            print(f"POTENTIAL UNCLOSED SPAN at line {i+1}: {line.strip()}")
