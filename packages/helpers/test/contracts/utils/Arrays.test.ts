import { expect } from 'chai'
import { Contract } from 'ethers'

import { deploy } from '../../../'

describe('Arrays', () => {
  let library: Contract

  beforeEach('deploy lib', async () => {
    library = await deploy('ArraysMock')
  })

  describe('from', () => {
    const ADDR_1 = '0x0000000000000000000000000000000000000001'
    const ADDR_2 = '0x0000000000000000000000000000000000000002'
    const ADDR_3 = '0x0000000000000000000000000000000000000003'
    const ADDR_4 = '0x0000000000000000000000000000000000000004'

    it('concatenates two addresses correctly', async () => {
      const result = await library.from1(ADDR_1, ADDR_2)

      expect(result.length).to.be.equal(2)
      expect(result[0]).to.be.equal(ADDR_1)
      expect(result[1]).to.be.equal(ADDR_2)
    })

    it('concatenates two addresses with an array correctly', async () => {
      const result = await library.from2(ADDR_1, [ADDR_2, ADDR_3], ADDR_4)

      expect(result.length).to.be.equal(4)
      expect(result[0]).to.be.equal(ADDR_1)
      expect(result[1]).to.be.equal(ADDR_2)
      expect(result[2]).to.be.equal(ADDR_3)
      expect(result[3]).to.be.equal(ADDR_4)
    })
  })

  describe('from', () => {
    it('concatenates correctly', async () => {
      const result = await library.from3(1, [])

      expect(result.length).to.be.equal(1)
      expect(result[0]).to.be.equal(1)
    })

    it('concatenates correctly', async () => {
      const result = await library.from3(1, [2])

      expect(result.length).to.be.equal(2)
      expect(result[0]).to.be.equal(1)
      expect(result[1]).to.be.equal(2)
    })

    it('concatenates correctly', async () => {
      const result = await library.from3(1, [2, 3])

      expect(result.length).to.be.equal(3)
      expect(result[0]).to.be.equal(1)
      expect(result[1]).to.be.equal(2)
      expect(result[2]).to.be.equal(3)
    })
  })
})
