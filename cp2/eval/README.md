# Evaluation & Golden Set (CP2)

This directory contains the tools and data required to run an automated evaluation of the LLM prompts used for grading student comprehension answers.

## Files
- `golden-set.json`: Contains 5 hand-crafted test cases covering happy paths and hard edge cases (Layers 1 to 4). It defines the expected outputs and behaviors of the LLM.
- `run-golden-set.js`: A Node.js script that iterates over `golden-set.json`, calls the LLM, and compares the actual output with the expected labels.

## How to Run

1. Make sure you have Node.js (v18+) installed.
2. Set your Gemini API key in the environment variables:
   ```bash
   export GEMINI_API_KEY="your_api_key_here"
   ```
   (Optional) To test OpenAI, set `OPENAI_API_KEY` and `PROVIDER=openai`:
   ```bash
   export OPENAI_API_KEY="your_openai_key"
   export PROVIDER="openai"
   ```
3. Run the script:
   ```bash
   node run-golden-set.js
   ```

## Results
The script prints the results of each test case and a final summary.
It also outputs a JSON file named `run-results-<timestamp>.json` with the raw evaluation results.

**Target**: >= 80% accuracy.
**Hard Fail Condition**: 0 False Positives on Layer 1 (No Evidence) and Layer 2 (Vague/Uncertain) cases.
