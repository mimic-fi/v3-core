import { deploy } from '@mimic-fi/v3-helpers'
import { expect } from 'chai'
import { Contract, utils } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

describe('AuthorizedHelpers', () => {
  let authorizedHelpers: Contract

  before('create authorizer', async () => {
    authorizedHelpers = await deploy('AuthorizedHelpersMock', [])
  })

  describe('authParams', () => {
    function itBehavesLikeAuthParams(paramsSig: string) {
      it('creates the array properly', async () => {
        const args = paramsSig.split(',').map((t, i) => {
          const s = `0x${i + 1}`
          if (t == 'bool') return true
          if (t == 'bytes4') return utils.hexZeroPad(s, 4)
          if (t == 'bytes32') return utils.hexZeroPad(s, 32)
          if (t == 'address') return utils.hexZeroPad(s, 20)
          return s
        })

        const result = await authorizedHelpers[`getAuthParams(${paramsSig})`](...args)
        expect(result.length).to.be.equal(args.length)

        result.forEach((actualValue, i) => {
          const arg = args[i]
          const expectedValue = typeof arg === 'boolean' ? Number(arg) : arg
          expect(actualValue).to.be.equal(expectedValue)
        })
      })
    }

    context('when the number of arguments is 1', async () => {
      itBehavesLikeAuthParams('address')
      itBehavesLikeAuthParams('bytes32')
      itBehavesLikeAuthParams('uint256')
    })

    context('when the number of arguments is 2', () => {
      itBehavesLikeAuthParams('address,bool')
      itBehavesLikeAuthParams('address,uint256')
      itBehavesLikeAuthParams('address,address')
      itBehavesLikeAuthParams('bytes32,bytes32')
    })

    context('when the number of arguments is 3', () => {
      itBehavesLikeAuthParams('address,address,uint256')
      itBehavesLikeAuthParams('address,address,address')
      itBehavesLikeAuthParams('address,address,bytes4')
      itBehavesLikeAuthParams('address,uint256,uint256')
    })

    context('when the number of arguments is 4', () => {
      itBehavesLikeAuthParams('address,address,uint256,uint256')
      itBehavesLikeAuthParams('address,uint256,address,uint256')
      itBehavesLikeAuthParams('address,uint256,uint256,uint256')
      itBehavesLikeAuthParams('bytes32,address,uint256,bool')
    })

    context('when the number of arguments is 5', () => {
      itBehavesLikeAuthParams('address,uint256,uint256,uint256,uint256')
    })
  })
})
