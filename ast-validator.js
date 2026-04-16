// AST-based validation for student Python code
// Uses Pyodide's built-in ast module to parse code and check structure.
// Loaded before validation.js — exposes window.ASTValidator (browser)
// or module.exports (Node/test).

// Python script that parses student code and returns a structural summary.
// Runs once per validateAnswer() call; the result is cached and reused
// by every ast_* rule in the same problem.
const AST_ANALYZE_SCRIPT = `
import ast, json

def _wavelet_analyze(code):
    """Parse student code and return a JSON summary of its structure."""
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return json.dumps({
            "error": True,
            "line": e.lineno,
            "col": e.offset,
            "msg": str(e.msg)
        })

    analysis = {
        "error": False,
        "node_types": [],
        "for_loops": [],
        "if_stmts": [],
        "method_calls": [],
        "function_calls": [],
        "assignments": [],
        "list_literals": 0,
        "subscripts": [],
        "anti_patterns": []
    }

    _seen_types = set()

    def _name(node):
        """Get a readable name from an AST node."""
        if isinstance(node, ast.Name):
            return node.id
        if isinstance(node, ast.Attribute):
            return _name(node.value) + "." + node.attr
        if isinstance(node, ast.Constant):
            return repr(node.value)
        return ""

    def visit(node, parent_types=None):
        if parent_types is None:
            parent_types = []

        node_type = type(node).__name__
        _seen_types.add(node_type)

        new_parents = parent_types

        if isinstance(node, ast.For):
            target = _name(node.target)
            iter_src = _name(node.iter)
            # Check if iterating over range(len(...))
            is_range_len = False
            if (isinstance(node.iter, ast.Call) and _name(node.iter.func) == "range"
                    and len(node.iter.args) == 1
                    and isinstance(node.iter.args[0], ast.Call)
                    and _name(node.iter.args[0].func) == "len"):
                is_range_len = True
            analysis["for_loops"].append({
                "target": target,
                "iter": iter_src,
                "is_range_len": is_range_len,
                "in_for": "For" in parent_types
            })
            new_parents = parent_types + ["For"]

        elif isinstance(node, ast.If):
            analysis["if_stmts"].append({
                "in_for": "For" in parent_types
            })
            new_parents = parent_types + ["If"]

        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Attribute):
                obj = _name(node.func.value)
                method = node.func.attr
                analysis["method_calls"].append({
                    "object": obj,
                    "method": method,
                    "in_for": "For" in parent_types
                })
            elif isinstance(node.func, ast.Name):
                name = node.func.id
                arg_calls = []
                for arg in node.args:
                    if isinstance(arg, ast.Call) and isinstance(arg.func, ast.Name):
                        arg_calls.append(arg.func.id)
                    elif isinstance(arg, ast.Call) and isinstance(arg.func, ast.Attribute):
                        arg_calls.append(_name(arg.func))
                analysis["function_calls"].append({
                    "name": name,
                    "arg_calls": arg_calls,
                    "in_for": "For" in parent_types
                })

        if isinstance(node, ast.List) and not isinstance(getattr(node, '_parent', None), ast.Subscript):
            analysis["list_literals"] += 1

        if isinstance(node, ast.Subscript):
            obj = _name(node.value)
            idx = None
            slice_node = node.slice
            if isinstance(slice_node, ast.Constant):
                idx = slice_node.value
            elif isinstance(slice_node, ast.UnaryOp) and isinstance(slice_node.op, ast.USub):
                if isinstance(slice_node.operand, ast.Constant):
                    idx = -slice_node.operand.value
            analysis["subscripts"].append({"object": obj, "index": idx})

        if isinstance(node, ast.Assign):
            for target_node in node.targets:
                target_name = _name(target_node)
                value_type = type(node.value).__name__

                # Anti-pattern: x = list.method()
                if isinstance(node.value, ast.Call) and isinstance(node.value.func, ast.Attribute):
                    method = node.value.func.attr
                    call_obj = _name(node.value.func.value)
                    analysis["anti_patterns"].append({
                        "type": "assign_to_method_result",
                        "target": target_name,
                        "object": call_obj,
                        "method": method
                    })

                analysis["assignments"].append({
                    "target": target_name,
                    "value_type": value_type
                })

        for child in ast.iter_child_nodes(node):
            visit(child, new_parents)

    visit(tree)
    analysis["node_types"] = sorted(_seen_types)
    return json.dumps(analysis)
`;

/**
 * Parse student code via Pyodide's ast module and return a structural summary.
 * Returns a plain JS object (the analysis), or an object with {error: true, ...}
 * if the code has a SyntaxError.
 */
async function parseStudentAST(code, pyodide) {
    if (!pyodide) return { error: true, msg: 'Pyodide not available' };

    try {
        // Ensure the analyze function is defined
        await pyodide.runPythonAsync(AST_ANALYZE_SCRIPT);

        // Call it with the student code
        const resultJSON = await pyodide.runPythonAsync(
            `_wavelet_analyze(${JSON.stringify(code)})`
        );
        return JSON.parse(resultJSON);
    } catch (err) {
        console.warn('AST parse failed:', err);
        return { error: true, msg: String(err) };
    }
}

/**
 * Validate a single AST rule against the cached analysis.
 * Returns {isValid: true} or {isValid: false, errorType, message}.
 */
function validateASTRule(astData, rule) {
    // If AST parse failed (e.g. SyntaxError), skip AST rules gracefully —
    // the runtime error check in validateAnswer will catch it.
    if (!astData || astData.error) {
        return { isValid: true };
    }

    switch (rule.type) {
        case 'ast_has_for_loop': {
            const found = astData.for_loops.length > 0;
            if (!found) {
                return {
                    isValid: false,
                    errorType: 'ast_has_for_loop_failed',
                    message: rule.message || 'Your code needs a for loop.'
                };
            }
            return { isValid: true };
        }

        case 'ast_has_if': {
            const inside = rule.inside || null;
            let found;
            if (inside === 'for') {
                found = astData.if_stmts.some(s => s.in_for);
            } else {
                found = astData.if_stmts.length > 0;
            }
            if (!found) {
                const detail = inside === 'for'
                    ? 'Your code needs an if statement inside the for loop.'
                    : 'Your code needs an if statement.';
                return {
                    isValid: false,
                    errorType: 'ast_has_if_failed',
                    message: rule.message || detail
                };
            }
            return { isValid: true };
        }

        case 'ast_has_method_call': {
            const method = rule.method;
            const found = astData.method_calls.some(c => c.method === method);
            if (!found) {
                return {
                    isValid: false,
                    errorType: 'ast_has_method_call_failed',
                    message: rule.message || `Your code needs to call .${method}().`
                };
            }
            return { isValid: true };
        }

        case 'ast_has_function_call': {
            const func = rule.function;
            const withArg = rule.withArg || null;
            let found;
            if (withArg) {
                found = astData.function_calls.some(
                    c => c.name === func && c.arg_calls.includes(withArg)
                );
            } else {
                found = astData.function_calls.some(c => c.name === func);
            }
            if (!found) {
                const detail = withArg
                    ? `Your code needs to call ${func}(${withArg}(...)).`
                    : `Your code needs to call ${func}().`;
                return {
                    isValid: false,
                    errorType: 'ast_has_function_call_failed',
                    message: rule.message || detail
                };
            }
            return { isValid: true };
        }

        case 'ast_has_list_literal': {
            const found = astData.list_literals > 0;
            if (!found) {
                return {
                    isValid: false,
                    errorType: 'ast_has_list_literal_failed',
                    message: rule.message || 'Your code needs to create a list with square brackets [].'
                };
            }
            return { isValid: true };
        }

        case 'ast_no_assign_to_method_result': {
            const method = rule.method;
            const violation = astData.anti_patterns.find(
                p => p.type === 'assign_to_method_result' && p.method === method
            );
            if (violation) {
                const detail = `.${method}() changes the list directly and returns None. ` +
                    `Remove the \`${violation.target} = \` part — just write \`${violation.object}.${method}(...)\`.`;
                return {
                    isValid: false,
                    errorType: 'ast_anti_pattern',
                    message: rule.message || detail
                };
            }
            return { isValid: true };
        }

        default:
            console.warn(`Unknown AST rule type: ${rule.type}`);
            return { isValid: true };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseStudentAST, validateASTRule, AST_ANALYZE_SCRIPT };
} else if (typeof window !== 'undefined') {
    window.ASTValidator = { parseStudentAST, validateASTRule };
}
