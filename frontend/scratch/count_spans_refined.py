
import re

with open(r'd:\Multitenant_chatbot\chatbot_portal-chatbot_flow_features\frontend\src\components\dashboard\DashboardTabPanels.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Match <span ... /> even across newlines
self_closing_spans = len(re.findall(r'<span[^>]*/>', content, re.DOTALL))
print(f"Self-closing spans: {self_closing_spans}")

opens = content.count('<span')
closes = content.count('</span>')
print(f"Total <span: {opens}")
print(f"Total </span>: {closes}")
print(f"Difference: {opens - closes}")
