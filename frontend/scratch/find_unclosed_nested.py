import sys
import re

def analyze_spans(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    stack = []
    for i, line in enumerate(lines):
        # Find all spans and closing spans in order
        # Specifically ignore self-closing spans <span ... />
        tokens = re.findall(r'<(?:span|div)(?![^>]*/>)|</(?:span|div)>', line)
        for token in tokens:
            if token.startswith('</'):
                if not stack:
                    print(f"ERROR: Closing {token[2:-1]} without opening at line {i+1}")
                else:
                    stack.pop()
            else:
                stack.append((token[1:], i + 1))
    
    if stack:
        print(f"ERROR: {len(stack)} unclosed tags found. Opening lines:")
        for tag, line_no in stack:
            print(f"  - {tag} at line {line_no}")
    else:
        print("All tags balanced.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        analyze_spans(sys.argv[1])
    else:
        print("Usage: python find_unclosed_nested.py <filename>")
