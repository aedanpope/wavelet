"""A command line tool to convert a worksheet to a csv file.

Outputs a CSV that can be imported into a spreadsheet, so that the author can edit the worksheet.

Doesn't output all the data, just the parts that are relevant to the author.

We will count on the AI agent to take the CSV and convert it back into a JSON file, filling in the missing data.

Usage:
    python worksheet_to_csv.py worksheet-1.json
    python worksheet_to_csv.py worksheet-1.json -o my_edits.csv

The CSV will contain the following columns:
- title: Problem title
- notes: Author feedback/notes for the AI agent (leave empty if no feedback needed)
- content: Problem description/explanation
- task: What the student needs to do
- starter_code: Starting code for the student
- hint: Helpful hint for the student
- validation_rules: Summary of validation rule types (for reference only)

Note: Problem numbers and IDs are implicit in the row order and will be reconstructed
when converting back to JSON.

After editing the CSV in a spreadsheet, the AI agent can convert it back to JSON
format, reconstructing the full validation rules and other metadata.
"""

import json
import csv
import sys
import os
import argparse
from pathlib import Path


def load_worksheet(json_file_path):
    """Load a worksheet JSON file."""
    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: File '{json_file_path}' not found.")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in '{json_file_path}': {e}")
        sys.exit(1)


def extract_problem_data(problem, problem_index):
    """Extract the key editable fields from a problem."""
    # Extract validation rules as a summary
    validation_summary = ""
    if 'validation' in problem and 'rules' in problem['validation']:
        rule_types = [rule.get('type', 'unknown') for rule in problem['validation']['rules']]
        validation_summary = "; ".join(rule_types)
    
    return {
        'title': problem.get('title', ''),
        'notes': '',  # Empty column for author feedback
        'content': problem.get('content', ''),
        'task': problem.get('task', ''),
        'starter_code': problem.get('starterCode', ''),
        'hint': problem.get('hint', ''),
        'validation_rules': validation_summary
    }


def worksheet_to_csv(worksheet, output_file):
    """Convert worksheet to CSV format."""
    # Define CSV headers for the editable fields
    headers = [
        'title',
        'notes',
        'content',
        'task',
        'starter_code',
        'hint',
        'validation_rules'
    ]
    
    # Extract problem data
    problems_data = []
    for i, problem in enumerate(worksheet.get('problems', [])):
        problem_data = extract_problem_data(problem, i)
        problems_data.append(problem_data)
    
    # Write to CSV
    try:
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=headers)
            writer.writeheader()
            writer.writerows(problems_data)
        
        print(f"Successfully converted worksheet to '{output_file}'")
        print(f"Worksheet: {worksheet.get('title', 'Unknown')}")
        print(f"Problems exported: {len(problems_data)}")
        
    except Exception as e:
        print(f"Error writing CSV file: {e}")
        sys.exit(1)


def main():
    """Main function to handle command line arguments and conversion."""
    parser = argparse.ArgumentParser(
        description="Convert a worksheet JSON file to CSV format for editing"
    )
    parser.add_argument(
        'input_file',
        help='Path to the JSON worksheet file'
    )
    parser.add_argument(
        '-o', '--output',
        help='Output CSV file path (default: input_file.csv)'
    )
    
    args = parser.parse_args()
    
    # Validate input file
    input_path = Path(args.input_file)
    if not input_path.exists():
        print(f"Error: Input file '{input_path}' does not exist.")
        sys.exit(1)
    
    # Determine output file path
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = input_path.with_suffix('.csv')
    
    # Load and convert worksheet
    worksheet = load_worksheet(input_path)
    worksheet_to_csv(worksheet, output_path)


if __name__ == "__main__":
    main()