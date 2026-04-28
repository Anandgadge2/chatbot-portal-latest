
import re

with open(r'd:\Multitenant_chatbot\chatbot_portal-chatbot_flow_features\frontend\src\components\dashboard\DashboardTabPanels.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

opens = content.count('<span')
self_closings = content.count('/>') # This is broad, but let's see
closes = content.count('</span>')

print(f"Opens: {opens}")
print(f"Closes: {closes}")
