// Expresiones numéricas de Database. No ejecuta JavaScript del proyecto.
const PROPERTIES = new Set(['hp', 'mp', 'mhp', 'mmp', 'atk', 'def', 'mat', 'mdf', 'agi', 'luk', 'level', 'exp', 'id'])
const FUNCTIONS = new Set(['abs', 'ceil', 'floor', 'round', 'trunc', 'sign', 'min', 'max', 'sqrt', 'pow', 'random'])
const CONSTANTS = { PI: Math.PI, E: Math.E }
const OPERATORS = { '||': 1, '&&': 2, '==': 3, '===': 3, '!=': 3, '!==': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6, '**': 7 }
const NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/
const IDENT = /^[A-Za-z_$][\w$]*/

function tokenize(source) {
  if (source.length > 1024) throw new Error('Expresión demasiado larga')
  const tokens = []
  for (let i = 0; i < source.length;) {
    if (/\s/.test(source[i])) { i++; continue }
    const rest = source.slice(i), number = rest.match(NUMBER), ident = !number && rest.match(IDENT)
    const op = number ? number[0] : ident ? ident[0] : ['===', '!==', '**', '<=', '>=', '==', '!=', '&&', '||'].find((x) => rest.startsWith(x)) || rest[0]
    if (!number && !ident && !'+-*/%()[]!.?,:<>'.includes(op) && !OPERATORS[op]) throw new Error(`Símbolo no permitido «${op}»`)
    tokens.push({ type: number ? 'number' : ident ? 'name' : 'symbol', value: op })
    if (tokens.length > 256) throw new Error('Expresión demasiado compleja')
    i += op.length
  }
  tokens.push({ type: 'end', value: '(fin)' })
  return tokens
}

function parse(source) {
  const tokens = tokenize(source)
  let at = 0, depth = 0
  const peek = () => tokens[at].value
  const take = (value) => { if (peek() !== value) throw new Error(`Se esperaba «${value}»; encontrado «${peek()}»`); at++ }

  const expression = (min = 0) => {
    if (++depth > 48) throw new Error('Demasiados paréntesis u operadores')
    let node
    const token = tokens[at++]
    if (token.type === 'number') node = { type: 'number', value: Number(token.value) }
    else if (token.value === '(') { node = expression(); take(')') }
    else if (['+', '-', '!'].includes(token.value)) node = { type: 'unary', op: token.value, arg: expression(7) }
    else if (token.type === 'name') {
      if (token.value === 'a' || token.value === 'b') {
        take('.')
        const prop = tokens[at++]
        if (prop.type !== 'name' || !PROPERTIES.has(prop.value)) throw new Error(`Estadística no permitida «${prop.value}»`)
        node = { type: 'stat', actor: token.value, prop: prop.value }
      } else if (token.value === 'v') {
        take('[')
        const id = tokens[at++]
        if (id.type !== 'number' || !/^\d+$/.test(id.value) || !Number.isSafeInteger(+id.value)) throw new Error('La variable debe tener un índice entero literal')
        take(']')
        node = { type: 'variable', id: id.value }
      } else if (token.value === 'Math') {
        take('.')
        const name = tokens[at++]
        if (name.type !== 'name') throw new Error('Función matemática no válida')
        if (Object.hasOwn(CONSTANTS, name.value)) node = { type: 'number', value: CONSTANTS[name.value] }
        else {
          if (!FUNCTIONS.has(name.value)) throw new Error(`Función matemática no permitida «${name.value}»`)
          take('(')
          const args = []
          if (peek() !== ')') {
            do { args.push(expression()); if (peek() !== ',') break; take(',') } while (args.length < 16)
          }
          take(')')
          node = { type: 'call', name: name.value, args }
        }
      } else throw new Error(`Identificador no permitido «${token.value}»`)
    } else throw new Error(`Expresión inválida cerca de «${token.value}»`)

    while (true) {
      if (peek() === '?' && min <= 0) {
        take('?'); const yes = expression(); take(':'); const no = expression()
        node = { type: 'conditional', cond: node, yes, no }; continue
      }
      const op = peek(), prec = OPERATORS[op]
      if (!prec || prec < min) break
      at++
      node = { type: 'binary', op, left: node, right: expression(prec + (op === '**' ? 0 : 1)) }
    }
    depth--
    return node
  }
  const ast = expression()
  if (tokens[at].type !== 'end') throw new Error(`Token inesperado «${peek()}»`)
  return ast
}

function finite(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error('El resultado no es un número finito')
  return n
}

function evaluate(node, a, b, getVar) {
  switch (node.type) {
    case 'number': return finite(node.value)
    case 'stat': return finite((node.actor === 'a' ? a : b)?.[node.prop])
    case 'variable': return finite(getVar?.(node.id) ?? 0)
    case 'unary': {
      const n = evaluate(node.arg, a, b, getVar)
      return finite(node.op === '+' ? n : node.op === '-' ? -n : !n ? 1 : 0)
    }
    case 'conditional': return evaluate(evaluate(node.cond, a, b, getVar) ? node.yes : node.no, a, b, getVar)
    case 'call': return finite(Math[node.name](...node.args.map((x) => evaluate(x, a, b, getVar))))
    case 'binary': {
      const x = evaluate(node.left, a, b, getVar)
      if (node.op === '&&' && !x) return x
      if (node.op === '||' && x) return x
      const y = evaluate(node.right, a, b, getVar)
      switch (node.op) {
        case '+': return finite(x + y)
        case '-': return finite(x - y)
        case '*': return finite(x * y)
        case '/': return finite(x / y)
        case '%': return finite(x % y)
        case '**': return finite(x ** y)
        case '<': return +(x < y)
        case '<=': return +(x <= y)
        case '>': return +(x > y)
        case '>=': return +(x >= y)
        case '==': case '===': return +(x === y)
        case '!=': case '!==': return +(x !== y)
        case '&&': return finite(y)
        case '||': return finite(y)
      }
    }
  }
  throw new Error('Expresión no reconocida')
}

/** Analiza la expresión completa antes de evaluarla; no lee propiedades ni ejecuta código arbitrario. */
export function evaluateFormula(source, a, b, getVar) {
  return evaluate(parse(String(source)), a, b, getVar)
}
