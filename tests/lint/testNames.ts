// The names a test file really declares, for the static coverage checks (번호 점검, 수치표). Parsed, not searched: a
// comment, a string elsewhere, `helper.test(…)` or `test.step(…)` declares nothing.
import ts from 'typescript';

const DECLARERS = new Set(['test', 'it', 'describe']);

/** `test`, `it`, `describe` or `test.describe` (host Q4: describe names count, step names do not). */
const declares = (callee: ts.Expression) =>
  (ts.isIdentifier(callee) && DECLARERS.has(callee.text)) ||
  (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'test' && callee.name.text === 'describe');

/** The first string-literal (or plain template) argument of every declaring call in `source`, in source order. */
export function declaredNames(source: string, fileName = 'test.ts'): string[] {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false, kind);
  const names: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && declares(node.expression)) {
      const first = node.arguments[0];
      if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) names.push(first.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return names;
}
