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
        "aug_assignments": [],
        "comparisons": [],
        "fstrings": [],
        "list_literals": [],
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
            # Determine what function the loop iterates over (e.g. "range")
            iter_func = None
            if isinstance(node.iter, ast.Call):
                iter_func = _name(node.iter.func)
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
                "iter_func": iter_func,
                "is_range_len": is_range_len,
                "in_for": "For" in parent_types
            })
            new_parents = parent_types + ["For"]

        elif isinstance(node, ast.If):
            has_else = len(node.orelse) > 0 and not (len(node.orelse) == 1 and isinstance(node.orelse[0], ast.If))
            has_elif = len(node.orelse) == 1 and isinstance(node.orelse[0], ast.If)
            analysis["if_stmts"].append({
                "in_for": "For" in parent_types,
                "has_else": has_else or has_elif,
                "has_elif": has_elif
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
                    "arg_count": len(node.args) + len(node.keywords),
                    "in_for": "For" in parent_types
                })

        if isinstance(node, ast.List) and not isinstance(getattr(node, '_parent', None), ast.Subscript):
            analysis["list_literals"].append({"size": len(node.elts)})

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

        if isinstance(node, ast.Compare):
            op_map = {
                ast.Eq: "==", ast.NotEq: "!=",
                ast.Lt: "<", ast.LtE: "<=",
                ast.Gt: ">", ast.GtE: ">=",
                ast.In: "in", ast.NotIn: "not in",
                ast.Is: "is", ast.IsNot: "is not"
            }
            ops = [op_map.get(type(op), str(type(op).__name__)) for op in node.ops]
            analysis["comparisons"].append({
                "ops": ops,
                "in_for": "For" in parent_types,
                "in_if": "If" in parent_types
            })

        if isinstance(node, ast.JoinedStr):
            variables = []
            for val in node.values:
                if isinstance(val, ast.FormattedValue):
                    if isinstance(val.value, ast.Name):
                        variables.append(val.value.id)
                    elif isinstance(val.value, ast.BinOp):
                        # e.g. {i + 1} — extract names from the expression
                        for sub in ast.walk(val.value):
                            if isinstance(sub, ast.Name):
                                variables.append(sub.id)
            analysis["fstrings"].append({
                "variables": variables,
                "in_for": "For" in parent_types
            })

        if isinstance(node, ast.AugAssign):
            op_map = {
                ast.Add: "+=", ast.Sub: "-=",
                ast.Mult: "*=", ast.Div: "/=",
                ast.Mod: "%=", ast.FloorDiv: "//="
            }
            analysis["aug_assignments"].append({
                "target": _name(node.target),
                "op": op_map.get(type(node.op), "?="),
                "in_for": "For" in parent_types
            })

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
            let found;
            if (rule.iterOver) {
                // Check that a for loop iterates over a specific function (e.g. "range")
                found = astData.for_loops.some(l => l.iter_func === rule.iterOver);
            } else {
                found = astData.for_loops.length > 0;
            }
            if (!found) {
                const detail = rule.iterOver
                    ? `Your code needs a for loop using ${rule.iterOver}().`
                    : 'Your code needs a for loop.';
                return {
                    isValid: false,
                    errorType: 'ast_has_for_loop_failed',
                    message: rule.message || detail
                };
            }
            return { isValid: true };
        }

        case 'ast_has_if': {
            const inside = rule.inside || null;
            let candidates = astData.if_stmts;
            if (inside === 'for') {
                candidates = candidates.filter(s => s.in_for);
            }
            if (candidates.length === 0) {
                const detail = inside === 'for'
                    ? 'Your code needs an if statement inside the for loop.'
                    : 'Your code needs an if statement.';
                return {
                    isValid: false,
                    errorType: 'ast_has_if_failed',
                    message: rule.message || detail
                };
            }
            // Check hasElse param
            if (rule.hasElse === true) {
                const hasOne = candidates.some(s => s.has_else);
                if (!hasOne) {
                    return {
                        isValid: false,
                        errorType: 'ast_has_if_failed',
                        message: rule.message || 'Your if statement needs an else block.'
                    };
                }
            }
            // Check hasElif param
            if (rule.hasElif === true) {
                const hasOne = candidates.some(s => s.has_elif);
                if (!hasOne) {
                    return {
                        isValid: false,
                        errorType: 'ast_has_if_failed',
                        message: rule.message || 'Your code needs an elif block.'
                    };
                }
            }
            return { isValid: true };
        }

        case 'ast_has_method_call': {
            const method = rule.method;
            let candidates = astData.method_calls.filter(c => c.method === method);
            if (rule.inside === 'for') {
                candidates = candidates.filter(c => c.in_for);
            }
            if (candidates.length === 0) {
                const detail = rule.inside === 'for'
                    ? `Your code needs to call .${method}() inside a for loop.`
                    : `Your code needs to call .${method}().`;
                return {
                    isValid: false,
                    errorType: 'ast_has_method_call_failed',
                    message: rule.message || detail
                };
            }
            return { isValid: true };
        }

        case 'ast_has_function_call': {
            const func = rule.function;
            const withArg = rule.withArg || null;
            const minArgs = typeof rule.minArgs === 'number' ? rule.minArgs : null;
            let candidates = astData.function_calls.filter(c => c.name === func);
            if (withArg) {
                candidates = candidates.filter(c => c.arg_calls.includes(withArg));
            }
            if (minArgs !== null) {
                candidates = candidates.filter(c => (c.arg_count || 0) >= minArgs);
            }
            if (candidates.length === 0) {
                let detail;
                if (minArgs !== null && withArg) {
                    detail = `Your code needs to call ${func}(${withArg}(...)) with at least ${minArgs} arguments.`;
                } else if (minArgs !== null) {
                    detail = `Your code needs to call ${func}() with at least ${minArgs} arguments.`;
                } else if (withArg) {
                    detail = `Your code needs to call ${func}(${withArg}(...)).`;
                } else {
                    detail = `Your code needs to call ${func}().`;
                }
                return {
                    isValid: false,
                    errorType: 'ast_has_function_call_failed',
                    message: rule.message || detail
                };
            }
            return { isValid: true };
        }

        case 'ast_has_list_literal': {
            const literals = astData.list_literals || [];
            if (literals.length === 0) {
                return {
                    isValid: false,
                    errorType: 'ast_has_list_literal_failed',
                    message: rule.message || 'Your code needs to create a list with square brackets [].'
                };
            }
            if (typeof rule.minItems === 'number') {
                const biggest = literals.reduce((max, l) => Math.max(max, l.size || 0), 0);
                if (biggest < rule.minItems) {
                    return {
                        isValid: false,
                        errorType: 'ast_has_list_literal_failed',
                        message: rule.message || `Your list needs at least ${rule.minItems} items.`
                    };
                }
            }
            return { isValid: true };
        }

        case 'ast_has_assignment': {
            // Check for regular assignments and/or augmented assignments (+=, -=, etc.)
            const allAssigns = [
                ...astData.assignments.map(a => ({ ...a, augOp: null })),
                ...astData.aug_assignments.map(a => ({ target: a.target, augOp: a.op, in_for: a.in_for }))
            ];
            let candidates = allAssigns;
            if (rule.augOp) {
                candidates = candidates.filter(a => a.augOp === rule.augOp);
            }
            if (candidates.length === 0) {
                const detail = rule.augOp
                    ? `Your code needs to use the ${rule.augOp} operator.`
                    : 'Your code needs a variable assignment.';
                return {
                    isValid: false,
                    errorType: 'ast_has_assignment_failed',
                    message: rule.message || detail
                };
            }
            return { isValid: true };
        }

        case 'ast_has_comparison': {
            let candidates = astData.comparisons;
            if (rule.op) {
                candidates = candidates.filter(c => c.ops.includes(rule.op));
            }
            if (candidates.length === 0) {
                const detail = rule.op
                    ? `Your code needs to use the ${rule.op} comparison operator.`
                    : 'Your code needs a comparison.';
                return {
                    isValid: false,
                    errorType: 'ast_has_comparison_failed',
                    message: rule.message || detail
                };
            }
            return { isValid: true };
        }

        case 'ast_has_fstring': {
            if (astData.fstrings.length === 0) {
                return {
                    isValid: false,
                    errorType: 'ast_has_fstring_failed',
                    message: rule.message || 'Your code needs to use an f-string (put f before the quotes).'
                };
            }
            // Check that specific variables appear inside the f-string
            if (rule.variables && rule.variables.length > 0) {
                const allVars = new Set();
                for (const fs of astData.fstrings) {
                    for (const v of fs.variables) {
                        allVars.add(v);
                    }
                }
                const missing = rule.variables.filter(v => !allVars.has(v));
                if (missing.length > 0) {
                    return {
                        isValid: false,
                        errorType: 'ast_has_fstring_failed',
                        message: rule.message || `Your f-string needs to include {${missing[0]}} inside the curly braces.`
                    };
                }
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
