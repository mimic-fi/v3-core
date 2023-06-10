import { expect } from 'chai'
import { Contract } from 'ethers'

import { NATIVE_TOKEN_ADDRESS } from '../../../src/constants'
import { deploy } from '../../../src/contracts'

describe('Denominations', () => {
  let library: Contract

  beforeEach('deploy lib', async () => {
    library = await deploy('DenominationsMock')
  })

  it('uses the expected native token address', async () => {
    expect(await library.NATIVE_TOKEN()).to.be.equal(NATIVE_TOKEN_ADDRESS)
  })
})
