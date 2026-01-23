import subprocess
import sys
import os

def run_audit():
    print("--- Starting Python Dependency Security Audit ---")
    
    # Target requirements file
    req_file = os.path.join(os.path.dirname(__file__), "..", "requirements.txt")
    if not os.path.exists(req_file):
        print(f"Error: requirements.txt not found at {req_file}")
        sys.exit(1)

    try:
        print(f"Auditing {os.path.abspath(req_file)}...")
        result = subprocess.run(["pip-audit", "-r", req_file], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ No vulnerabilities found in Python dependencies.")
            print(result.stdout)
        else:
            print("❌ Vulnerabilities found!")
            print(result.stdout)
            print(result.stderr)
            # We don't exit with error here to allow the script to finish and report
    except FileNotFoundError:
        print("pip-audit not installed. Attempting to install...")
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "pip-audit"], check=True)
            print("Successfully installed pip-audit. Retrying audit...")
            # Recursive call once installed
            run_audit()
        except Exception as e:
            print(f"Failed to install pip-audit: {e}")
            sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_audit()
