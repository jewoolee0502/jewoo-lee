// Pure terminal parsing (plan Phase 4 TEST LIST; prototype L894–939, fix B15).
import { describe, it, expect } from 'vitest'
import { parseLine, levenshtein, suggest, resolveOpen } from './parse.js'
import { PROJECTS } from '../../../content/index.js'

// NAMES (L894), copied as a Map so resolveOpen is tested with the prototype's aliases.
const NAMES = new Map([
  ['about', 'about'],
  ['projects', 'projects'],
  ['experience', 'exp'],
  ['exp', 'exp'],
  ['skills', 'skills'],
  ['terminal', 'term'],
  ['resume', 'resume'],
  ['cv', 'resume'],
  ['mail', 'mail'],
  ['contact', 'mail'],
  ['bughunt', 'bugs'],
  ['bugs', 'bugs'],
  ['snake', 'snake'],
  ['service', 'service'],
  ['wallpaper', 'display'],
  ['display', 'display'],
  ['trophies', 'ach'],
  ['achievements', 'ach'],
  ['bin', 'bin'],
  ['recyclebin', 'bin'],
])

// Command names in the insertion order of the prototype's C object (L895–926).
const COMMAND_ORDER = [
  'help', 'whoami', 'neofetch', 'ls', 'projects', 'open', 'cat', 'skills', 'experience', 'contact',
  'snake', 'bugs', 'matrix', 'weather', 'lamp', 'wallpaper', 'salute', 'sudo', 'coffee',
  'date', 'pwd', 'cd', 'echo', 'hello', 'hi', '안녕', 'git', 'vim', 'rm', 'cheat', 'history',
  'clear', 'exit', 'shutdown',
]

describe('parseLine', () => {
  it('turns a blank line into an empty command', () => {
    expect(parseLine('   ')).toMatchObject({ line: '', cmd: '', args: '' })
  })

  it('lower-cases the command and keeps the argument text', () => {
    expect(parseLine('OPEN   Snake.exe')).toMatchObject({ cmd: 'open', args: 'Snake.exe' })
  })

  it('collapses whitespace inside the arguments', () => {
    expect(parseLine('echo a   b')).toMatchObject({ cmd: 'echo', args: 'a b' })
  })

  it('keeps the first word as typed in c0 (used by the not-found message)', () => {
    expect(parseLine('OPEN   Snake.exe').c0).toBe('OPEN')
  })
})

describe('levenshtein', () => {
  it('computes the edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('help', 'help')).toBe(0)
  })
})

describe('suggest', () => {
  it('suggests the closest name within distance 2', () => {
    expect(suggest('hepl', COMMAND_ORDER)).toBe('help')
    expect(suggest('snak', COMMAND_ORDER)).toBe('snake')
  })

  it('returns null when nothing is within distance 2', () => {
    expect(suggest('xyz', COMMAND_ORDER)).toBeNull()
  })
})

describe('resolveOpen', () => {
  const resolve = (a) => resolveOpen(a, { projects: PROJECTS, names: NAMES })

  it('resolves p<n> and bare numbers to projects (1-based)', () => {
    expect(resolve('p1')).toEqual({ kind: 'project', index: 0 })
    expect(resolve('P9')).toEqual({ kind: 'project', index: 8 })
    expect(resolve('9')).toEqual({ kind: 'project', index: 8 })
  })

  it('rejects out-of-range numbers, including p0 and p10', () => {
    expect(resolve('p10')).toMatchObject({ kind: 'none' })
    expect(resolve('p0')).toMatchObject({ kind: 'none' })
  })

  it('resolves names through the NAMES map, ignoring spaces and file extensions', () => {
    expect(resolve('Visitor Wall')).toMatchObject({ kind: 'none' })
    expect(resolve('Paint')).toMatchObject({ kind: 'none' })
    expect(resolve('recycle bin')).toMatchObject({ kind: 'app', id: 'bin' })
    expect(resolve('Trophies.exe')).toMatchObject({ kind: 'app', id: 'ach' })
  })

  it('matches a project title by prefix with whitespace removed', () => {
    expect(resolve('rec')).toEqual({ kind: 'project', index: 0 })
    expect(resolve('jo')).toEqual({ kind: 'project', index: 8 })
  })

  it('never resolves inherited object keys (fix B1)', () => {
    expect(resolve('constructor')).toMatchObject({ kind: 'none' })
    expect(resolve('__proto__')).toMatchObject({ kind: 'none' })
  })

  it('returns none with "(nothing)" for an empty argument', () => {
    expect(resolve('')).toMatchObject({ kind: 'none', shown: '(nothing)' })
  })
})
