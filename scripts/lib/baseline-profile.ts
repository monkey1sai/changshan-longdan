import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { MOVES } from '../../src/combat/moves.ts'
import { DIFFICULTIES } from '../../src/core/difficulty.ts'
import { PLAYER_START, PLAY_LIMIT } from '../../src/world/layout.ts'

export const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex')

function parse(source: string) {
  return ts.createSourceFile('baseline-source.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

function numeric(node: ts.Node, file: ts.SourceFile): number {
  if (!ts.isNumericLiteral(node)) throw new Error(`unsupported numeric expression: ${node.getText(file)}`)
  const value = Number(node.text)
  if (!Number.isFinite(value)) throw new Error('non-finite numeric source')
  return value
}

export function readNumericConstant(source: string, name: string): number {
  const file = parse(source)
  const found: ts.VariableDeclaration[] = []
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) found.push(declaration)
    }
  }
  if (found.length !== 1 || !found[0].initializer) throw new Error(`expected one numeric declaration: ${name}`)
  return numeric(found[0].initializer, file)
}

function classMember(source: string, className: string, memberName: string) {
  const file = parse(source)
  const classes = file.statements.filter(node => ts.isClassDeclaration(node) && node.name?.text === className) as ts.ClassDeclaration[]
  if (classes.length !== 1) throw new Error(`expected one class: ${className}`)
  const members = classes[0].members.filter(member => memberName === 'constructor'
    ? ts.isConstructorDeclaration(member) : member.name?.getText(file) === memberName)
  if (members.length !== 1) throw new Error(`expected one member: ${className}.${memberName}`)
  return { file, member: members[0] }
}

export function readRepeatRules(source: string) {
  const { file, member } = classMember(source, 'Input', 'poll')
  const rules: { kind: 'attackRepeat' | 'chargeSuppression'; value: number; condition: string; line: number }[] = []
  const visit = (node: ts.Node) => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      node.left.getText(file) === 'this.attackRepeat' && ts.isNumericLiteral(node.right)) {
      const value = numeric(node.right, file)
      if (value > 0) {
        let parent: ts.Node | undefined = node.parent
        while (parent && !ts.isIfStatement(parent)) parent = parent.parent
        const condition = parent && ts.isIfStatement(parent) ? parent.expression.getText(file) : ''
        const normalized = condition.replace(/\s/g, '').replaceAll('"', "'")
        const kind = normalized === '!guard&&this.attackRepeat===0' ? 'attackRepeat'
          : normalized === "this.pressed.has('charge')" ? 'chargeSuppression' : null
        if (!kind) throw new Error('unsupported Input.poll repeat condition')
        rules.push({ kind, value, condition, line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1 })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(member)
  if (rules.length !== 2 || new Set(rules.map(rule => rule.kind)).size !== 2) throw new Error('expected both Input.poll repeat rules')
  return rules
}

export const readRepeatAssignments = (source: string): number[] => readRepeatRules(source).map(rule => rule.value)

function callNumbers(source: string, className: string, memberName: string, callee: string, indices: number[]) {
  const { file, member } = classMember(source, className, memberName)
  const calls: (ts.CallExpression | ts.NewExpression)[] = []
  const visit = (node: ts.Node) => {
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && node.expression.getText(file) === callee) calls.push(node)
    ts.forEachChild(node, visit)
  }
  visit(member)
  if (calls.length !== 1 || !calls[0].arguments) throw new Error(`expected one call: ${className}.${memberName}/${callee}`)
  return indices.map(index => {
    const argument = calls[0].arguments![index]
    if (!argument) throw new Error('missing numeric argument')
    return numeric(argument, file)
  })
}

export function readEffectiveProfile(root: string) {
  // Imported objects and file hashes must refer to the same checkout.
  if (resolve(root) !== resolve(fileURLToPath(new URL('../../', import.meta.url)))) throw new Error('effective profile root must match the runner checkout')
  const paths = ['src/entities/player.ts', 'src/entities/enemies.ts', 'src/core/input.ts', 'src/game.ts',
    'src/combat/moves.ts', 'src/combat/stamp.ts', 'src/combat/hitshape.ts', 'src/core/math.ts',
    'src/core/difficulty.ts', 'src/entities/battle-director.ts', 'src/entities/arena.ts',
    'src/view/camera-rig.ts', 'src/world/layout.ts']
  const sources = Object.fromEntries(paths.map(path => [path, readFileSync(join(root, path), 'utf8')]))
  const constants = (path: string, names: string[]) => Object.fromEntries(names.map(name => [name, readNumericConstant(sources[path], name)]))
  const repeats = readRepeatRules(sources['src/core/input.ts'])
  const maxDt = callNumbers(sources['src/game.ts'], 'Game', 'frame', 'Math.min', [0])[0]
  const feedbackSeed = callNumbers(sources['src/game.ts'], 'Game', 'rng', 'createRng', [0])[0]
  const camera = callNumbers(sources['src/view/camera-rig.ts'], 'CameraRig', 'constructor', 'PerspectiveCamera', [0, 2, 3])
  return {
    schema: 'e01-scoped-effective-profile/v1', candidateProfileConnected: false,
    scope: 'actual move/difficulty objects and explicitly listed numeric source declarations/calls',
    notCovered: ['all private field defaults', 'all AI branch literals', 'guard cosine expression', 'renderer/GPU tuning', 'natural retry RNG history'],
    player: constants('src/entities/player.ts', ['MUSOU_MAX', 'RUN_SPEED', 'GRAVITY', 'JUMP_SPEED', 'DODGE_SPEED', 'DODGE_TIME', 'DASH_CANCEL_TIME', 'PARRY_TIME', 'COUNTER_TIME', 'BUFFER']),
    enemies: constants('src/entities/enemies.ts', ['GRAVITY', 'BODY_RADIUS', 'RELEASE_RANGE', 'MAX_ENGAGED', 'MIN_ENGAGED', 'RING_SIZE']),
    game: { ...constants('src/game.ts', ['CAPACITY', 'MUSIC_LEVEL']), frameMaxDtSec: maxDt, feedbackSeed },
    input: { attackRepeatSec: repeats.find(rule => rule.kind === 'attackRepeat')!.value,
      chargeSuppressRepeatSec: repeats.find(rule => rule.kind === 'chargeSuppression')!.value, source: 'Input.poll validated conditional assignments', rules: repeats },
    camera: { fovDeg: camera[0], near: camera[1], far: camera[2] },
    layout: { playerStart: { ...PLAYER_START }, playLimit: PLAY_LIMIT },
    moves: structuredClone(MOVES), difficulties: structuredClone(DIFFICULTIES),
    sourceHashes: Object.fromEntries(paths.map(path => [path, sha256(sources[path])])),
  }
}
