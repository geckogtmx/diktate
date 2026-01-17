import sys
import os

# Add python dir to path
sys.path.insert(0, os.getcwd())

try:
    from core.processor import LocalProcessor
    from config.prompts import PROMPT_PROFESSIONAL

    print("Initializing Processor...")
    p = LocalProcessor(mode="standard")
    
    print(f"Initial Mode: {p.mode}")
    print(f"Initial Prompt Length: {len(p.prompt)}")

    print("\nSwitching to Professional...")
    p.set_mode("professional")
    
    print(f"New Mode: {p.mode}")
    print(f"New Prompt Length: {len(p.prompt)}")
    
    if p.prompt == PROMPT_PROFESSIONAL:
        print("\nSUCCESS: Prompt matched Professional template.")
    else:
        print("\nFAILURE: Prompt did not match.")

except Exception as e:
    print(f"\nERROR: {e}")
