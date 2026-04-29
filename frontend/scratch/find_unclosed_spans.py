
import re

def find_unclosed(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove self-closing tags
    content = re.sub(r'<span[^>]*/>', 'SELF_CLOSING_SPAN', content)
    
    # Find all opens and closes
    tokens = re.findall(r'<span[^>]*>|</span>', content)
    
    stack = []
    for i, token in enumerate(tokens):
        if token == '</span>':
            if not stack:
                print(f"ERROR: Found closing </span> without an opening at token index {i}")
            else:
                stack.pop()
        else:
            stack.append((token, i))
    
    if stack:
        print(f"ERROR: {len(stack)} unclosed <span> tags found.")
        for token, idx in stack:
            # Find the line number for this token
            # This is a bit slow but works
            pos = 0
            for _ in range(idx + 1):
                pos = content.find(token, pos) + 1
            
            line_no = content.count('\n', 0, pos) + 1
            print(f"  - Unclosed {token} at line {line_no}")

find_unclosed(r'd:\Multitenant_chatbot\chatbot_portal-chatbot_flow_features\frontend\src\components\dashboard\DashboardTabPanels.tsx')
