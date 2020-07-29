const Postr = require('../index')
const defaultConfig = require('./_data/config')

it('throws error if missing config', () => {
  expect(Postr).toThrow(Error)
})

it('runs when required options are passed', () => {
  const postr = Postr(defaultConfig)
  expect(typeof postr).toEqual('object')
})
