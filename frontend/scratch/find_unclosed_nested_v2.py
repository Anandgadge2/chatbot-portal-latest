import re
import sys

def find_unclosed_tags(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    stack = []
    for i, line in enumerate(lines):
        # Match <div or <span but NOT <div ... /> or <span ... />
        # This is a bit simplistic but works for many cases
        # We need to be careful with attributes
        
        # Find all openings
        # Regex for <div or <span
        # Then check if it's self-closing
        
        clean_line = re.sub(r'\{/\*.*?\*/\}', '', line) # Remove comments
        
        tokens = re.findall(r'<(div|span)\b[^>]*>|</div>|</span>', clean_line)
        
        # re.findall with groups returns the groups. 
        # We need to find the whole match to know if it's opening or closing.
        
        # Let's use a better approach
        full_tokens = re.finditer(r'<(div|span)\b[^>]*>|</div>|</span>', clean_line)
        for match in full_tokens:
            text = match.group(0)
            if text.startswith('</'):
                if not stack:
                    print(f"Extra closing tag {text} at line {i+1}")
                else:
                    tag, line_num = stack.pop()
                    expected = f"</{tag}>"
                    if text != expected:
                        print(f"Mismatched tag at line {i+1}: expected {expected}, got {text}. Opened at line {line_num}")
            elif '/>' in text:
                continue # Self-closing
            else:
                tag = match.group(1)
                stack.append((tag, i+1))

    if stack:
        print(f"ERROR: {len(stack)} unclosed tags found. Opening lines:")
        for tag, line_num in stack:
            print(f"  - {tag} at line {line_num}")
    else:
        print("All tags are balanced!")

if __name__ == "__main__":
    find_unclosed_tags(sys.argv[1])
