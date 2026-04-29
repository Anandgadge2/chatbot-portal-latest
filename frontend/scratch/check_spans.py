
import re

with open(r'd:\Multitenant_chatbot\chatbot_portal-chatbot_flow_features\frontend\src\components\dashboard\DashboardTabPanels.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

span_count = 0
for i, line in enumerate(lines):
    opens = len(re.findall(r'<span(?![^>]*/>)', line))
    closes = len(re.findall(r'</span>', line))
    span_count += opens - closes
    if opens != closes:
        print(f"Line {i+1}: balance={span_count} | {line.strip()}")
    if span_count < 0:
        print(f"ERROR: Negative span count at line {i+1}")
        span_count = 0

print(f"Final span balance: {span_count}")
