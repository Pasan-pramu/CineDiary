import { describe, expect, it } from 'vitest'
import { WATCHED_ANSWERS, answerToTitle } from './constants'

describe('"Have you watched it?" answers', () => {
  it('asks three main questions; Dropped is the extra, smaller choice', () => {
    expect(WATCHED_ANSWERS.map((answer) => answer.label)).toEqual([
      'Not yet',
      'Watching now',
      'Already watched'
    ])
  })

  it('only Not yet and Dropped save a title without a watch', () => {
    expect(answerToTitle('not_yet')).toEqual({ status: 'planned' })
    expect(answerToTitle('dropped')).toEqual({ status: 'dropped' })
    // The watch sets the status (watching / completed) once it is saved.
    expect(answerToTitle('watching')).toEqual({ status: 'planned', firstWatch: 'watching' })
    expect(answerToTitle('watched')).toEqual({ status: 'planned', firstWatch: 'watched' })
  })
})
