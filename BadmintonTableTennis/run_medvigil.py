import subprocess

# Run medvigil.py as a separate process
process = subprocess.run(["python3", "medvigil.py"], capture_output=True, text=True)

# Print output to console
print(process.stdout)
print(process.stderr)
