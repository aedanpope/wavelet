# Minimal Progress Persistence Implementation

## Overview
Simple browser session storage that saves progress when students run code, with a "Start Over" button to reset the current worksheet.

## Design Principles
- **Minimal features**: Only essential progress tracking
- **Simple implementation**: ~20 lines of code total
- **No UI complexity**: No save indicators or complex state management
- **Privacy-focused**: Everything stays in browser session

## Data Structure
```javascript
// Per-worksheet progress stored in localStorage
{
  "worksheet-1": {
    "completedProblems": [0, 1, 2],
    "problems": [
      {
        "code": "print('Hello World')",
        "completed": true,
        "output": "Hello World",
        "message": "✅ Correct! Well done!",
        "status": "success"
      },
      {
        "code": "x = 5\nprint(x)",
        "completed": false,
        "output": "5",
        "message": "❌ Not quite right! Check the task requirements and try again.",
        "status": "error"
      }
    ]
  }
}
```

## Implementation Points

### 1. Save Triggers
- **When**: Every time student clicks "Run Code" (success or failure)
- **What**: Code, output, status, and completed problems for each problem
- **Where**: `localStorage` (survives page refresh and tab closure)

### 2. Recovery Logic
- **On worksheet page load**: Check localStorage for saved state for current worksheet
- **If found**: Restore code, output, status, and completed problems for each problem
- **If not found**: Start fresh with starter code and no completed problems

### 3. Start Over Button
- **Location**: Top-right corner of worksheet interface
- **Action**: Clear progress for current worksheet only and reload page
- **Text**: "Start Over"

## Technical Implementation

### Storage Functions
```javascript
// Save progress for current worksheet
function saveProgress(worksheetId) {
  const allProgress = JSON.parse(sessionStorage.getItem('pythonProgress') || '{}');
  const worksheetProgress = {
    completedProblems: Array.from(completedProblems),
    problems: []
  };
  
  // Save state for each problem (code, output, status)
  currentWorksheet.problems.forEach((problem, index) => {
    const codeEditor = codeEditors[index];
    const outputElement = document.getElementById(`output-${index}`);
    
    let problemState = {
      code: codeEditor ? codeEditor.getValue() : '',
      completed: completedProblems.has(index)
    };
    
    // Save output and status if available
    if (outputElement && outputElement.innerHTML !== '') {
      const outputContent = outputElement.querySelector('.output-content');
      const outputMessage = outputElement.querySelector('.output-message');
      
      if (outputContent) {
        problemState.output = outputContent.textContent;
      }
      if (outputMessage) {
        problemState.message = outputMessage.textContent;
        problemState.status = outputElement.className.includes('success') ? 'success' : 
                            outputElement.className.includes('error') ? 'error' : 'normal';
      }
    }
    
    worksheetProgress.problems.push(problemState);
  });
  
  allProgress[worksheetId] = worksheetProgress;
  sessionStorage.setItem('pythonProgress', JSON.stringify(allProgress));
}
```

// Load saved progress for specific worksheet
function loadProgress(worksheetId) {
  const allProgress = JSON.parse(sessionStorage.getItem('pythonProgress') || '{}');
  return allProgress[worksheetId] || null;
}

// Clear progress for current worksheet only
function clearWorksheetProgress(worksheetId) {
  const allProgress = JSON.parse(sessionStorage.getItem('pythonProgress') || '{}');
  delete allProgress[worksheetId];
  sessionStorage.setItem('pythonProgress', JSON.stringify(allProgress));
  location.reload();
}
```

### Integration Points
1. **Run Code button**: Call `saveProgress()` after code execution
2. **Worksheet page load**: Check `loadProgress()` and restore full state (code, output, status)
3. **Start Over button**: Call `clearWorksheetProgress()`

## Benefits
- **Minimal code**: ~20 lines total
- **Simple logic**: Just save/load/clear per worksheet
- **No UI complexity**: No save indicators or complex state
- **Reliable**: Local storage is well-supported
- **Privacy**: Everything stays in browser
- **Independent worksheets**: Each worksheet has separate progress

## Edge Cases Handled
- **Storage fails**: App continues normally without persistence
- **Corrupted data**: Clear and start fresh
- **Multiple tabs**: Each tab has independent progress
- **Worksheet switching**: Progress preserved when switching between worksheets

## Files to Modify
- `script.js`: Add storage functions and integration
- `worksheet.html`: Add Start Over button to UI
- `styles.css`: Style for Start Over button