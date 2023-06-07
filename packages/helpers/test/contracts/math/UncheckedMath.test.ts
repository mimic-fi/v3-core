import { expect } from 'chai'
import { Contract } from 'ethers'

import { deploy } from '../../../'
import { MAX_UINT256 } from '../../../src/constants'

describe('UncheckedMath', () => {
  let library: Contract

  beforeEach('deploy lib', async () => {
    library = await deploy('UncheckedMathMock')
  })

  describe('add', () => {
    it('computes add correctly', async () => {
      expect(await library.add(0, 0)).to.be.equal(0)
      expect(await library.add(0, 2)).to.be.equal(2)
      expect(await library.add(2, 0)).to.be.equal(2)
      expect(await library.add(2, 2)).to.be.equal(4)
      expect(await library.add(MAX_UINT256, 1)).to.be.equal(0)
    })
  })

  describe('sub', () => {
    it('computes sub correctly', async () => {
      expect(await library.sub(2, 0)).to.be.equal(2)
      expect(await library.sub(2, 2)).to.be.equal(0)
      expect(await library.sub(4, 2)).to.be.equal(2)
      expect(await library.sub(0, 1)).to.be.equal(MAX_UINT256)
    })
  })

  describe('mul', () => {
    it('computes mul correctly', async () => {
      expect(await library.mul(0, 2)).to.be.equal(0)
      expect(await library.mul(2, 0)).to.be.equal(0)
      expect(await library.mul(2, 2)).to.be.equal(4)

      expect(await library.mulInt(0, -2)).to.be.equal(0)
      expect(await library.mulInt(-2, 0)).to.be.equal(0)
      expect(await library.mulInt(-2, 2)).to.be.equal(-4)
      expect(await library.mulInt(2, -2)).to.be.equal(-4)
      expect(await library.mulInt(-2, -2)).to.be.equal(4)
    })
  })

  describe('div', () => {
    it('computes div correctly', async () => {
      expect(await library.div(0, 2)).to.be.equal(0)
      expect(await library.div(1, 2)).to.be.equal(0)
      expect(await library.div(4, 2)).to.be.equal(2)
      await expect(library.div(2, 0)).to.be.revertedWith('reverted with panic code 18')
    })
  })
})
