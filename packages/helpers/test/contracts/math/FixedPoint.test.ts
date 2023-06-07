import { expect } from 'chai'
import { Contract } from 'ethers'

import { deploy } from '../../../src/contracts'
import { fp } from '../../../src/numbers'

describe('FixedPoint', () => {
  let library: Contract

  beforeEach('deploy lib', async () => {
    library = await deploy('FixedPointMock')
  })

  describe('mulUp', () => {
    it('computes mul up correctly', async () => {
      expect(await library.mulUp(1, 1)).to.be.equal(1)
      expect(await library.mulUp(fp(2), 0)).to.be.equal(0)
      expect(await library.mulUp(fp(2), fp(2))).to.be.equal(fp(4))
      expect(await library.mulUp(fp(4), fp(2))).to.be.equal(fp(8))
    })
  })

  describe('mulDown', () => {
    it('computes mul down correctly', async () => {
      expect(await library.mulDown(1, 1)).to.be.equal(0)
      expect(await library.mulDown(fp(2), 0)).to.be.equal(0)
      expect(await library.mulDown(fp(2), fp(2))).to.be.equal(fp(4))
      expect(await library.mulDown(fp(4), fp(2))).to.be.equal(fp(8))
    })
  })

  describe('divUp', () => {
    it('computes div up correctly', async () => {
      expect(await library.divUp(1, 1)).to.be.equal(fp(1))
      expect(await library.divUp(0, fp(2))).to.be.equal(0)
      expect(await library.divUp(fp(2), fp(2))).to.be.equal(fp(1))
      await expect(library.divUp(fp(2), 0)).to.be.revertedWith('ZERO_DIVISION')
    })
  })

  describe('divDown', () => {
    it('computes div down correctly', async () => {
      expect(await library.divDown(1, 1)).to.be.equal(fp(1))
      expect(await library.divDown(0, fp(2))).to.be.equal(0)
      expect(await library.divDown(fp(2), fp(2))).to.be.equal(fp(1))
      await expect(library.divDown(fp(2), 0)).to.be.revertedWith('ZERO_DIVISION')
    })
  })
})
