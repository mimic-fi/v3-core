import { bn, deploy, ONES_ADDRESS } from '@mimic-fi/v3-helpers'
import { expect } from 'chai'
import { Contract } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

describe('AuthorizedHelpers', () => {
  let authorizedHelpers: Contract

  before('create authorizer', async () => {
    authorizedHelpers = await deploy('AuthorizedHelpersMock', [])
  })

  describe('authParams', () => {
    const address = ONES_ADDRESS
    const bytes32 = '0x0000000000000000000000000000000000000000000000000000000000000002'
    const uint256 = bn(100)
    const bool = true
    const bytes4 = '0x00000001'

    function itBehavesLikeAuthParams(params: string, ...args) {
      it('creates the array properly', async () => {
        const functionSignature = 'getAuthParams(' + params + ')'
        const result = await authorizedHelpers[functionSignature](...args)

        expect(result.length).to.be.equal(args.length)

        result.forEach((v, i) => {
          const arg = args[i]
          const expectedValue = typeof arg === 'boolean' ? Number(arg) : arg
          expect(v).to.be.equal(expectedValue)
        })
      })
    }

    context('when the number of arguments is 1', async () => {
      itBehavesLikeAuthParams('address', address)
      itBehavesLikeAuthParams('bytes32', bytes32)
      itBehavesLikeAuthParams('uint256', uint256)
    })

    context('when the number of arguments is 2', () => {
      itBehavesLikeAuthParams('address,bool', address, bool)
      itBehavesLikeAuthParams('address,uint256', address, uint256)
      itBehavesLikeAuthParams('address,address', address, address)
      itBehavesLikeAuthParams('bytes32,bytes32', bytes32, bytes32)
    })

    context('when the number of arguments is 3', () => {
      itBehavesLikeAuthParams('address,address,uint256', address, address, uint256)
      itBehavesLikeAuthParams('address,address,address', address, address, address)
      itBehavesLikeAuthParams('address,address,bytes4', address, address, bytes4)
      itBehavesLikeAuthParams('address,uint256,uint256', address, uint256, uint256)
    })

    context('when the number of arguments is 4', () => {
      itBehavesLikeAuthParams('address,address,uint256,uint256', address, address, uint256, uint256)
      itBehavesLikeAuthParams('address,uint256,uint256,uint256', address, uint256, uint256, uint256)
      itBehavesLikeAuthParams('bytes32,address,uint256,bool', bytes32, address, uint256, bool)
    })

    context('when the number of arguments is 5', () => {
      itBehavesLikeAuthParams('address,uint256,uint256,uint256,uint256', address, uint256, uint256, uint256, uint256)
    })
  })
})
