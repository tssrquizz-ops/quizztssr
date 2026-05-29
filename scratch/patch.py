import os

# Paths
game_path = r"c:\Users\quizztssr\Desktop\quizztssr-main\quizztssr-main\js\game.js"
logic_path = r"c:\Users\quizztssr\Desktop\quizztssr-main\quizztssr-main\scratch\online_logic.js"

# Read game.js
with open(game_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Read new logic
with open(logic_path, "r", encoding="utf-8") as f:
    new_logic = f.read()

# Find bounds
start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "// DUEL EN LIGNE V2" in line:
        start_idx = i - 1  # include the `// ========` above it
    if "function startReview()" in line:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    print(f"Replacing lines {start_idx} to {end_idx}")
    # Replace
    new_content = "".join(lines[:start_idx]) + new_logic + "\n" + "".join(lines[end_idx:])
    with open(game_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Success")
else:
    print(f"Failed to find bounds: {start_idx}, {end_idx}")
