import { expect } from 'chai'
import { Contract } from 'ethers'
import { hexlify, hexZeroPad } from 'ethers/lib/utils'

import { deploy } from '../../../'

describe('BytesHelpers', () => {
  let library: Contract

  beforeEach('deploy lib', async () => {
    library = await deploy('BytesHelpersMock')
  })

  describe('toUint256', () => {
    const bytes =
      '0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002'

    it('extracts an uint256 correctly', async () => {
      expect(await library.toUint256(bytes, 0)).to.be.equal(1)
      expect(await library.toUint256(bytes, 32)).to.be.equal(2)
    })

    it('reverts if out of bounds', async () => {
      await expect(library.toUint256(bytes, 64)).to.be.revertedWith('BytesOutOfBounds')
      await expect(library.toUint256(bytes, 33)).to.be.revertedWith('BytesOutOfBounds')
    })
  })

  describe('concat', () => {
    const array = '0xabcdef'

    it('concatenates an address with a bytes array', async () => {
      const address = '0xffffffffffffffffffffffffffffffffffffffff'
      const result = await library.concat1(array, address)

      expect(result).to.be.equal(array + address.slice(2))
    })

    it('concatenates an uint24 with a bytes array', async () => {
      const number = 5
      const result = await library.concat2(array, number)

      expect(result).to.be.equal(array + hexZeroPad(hexlify(number), 3).slice(2))
    })
  })
})
