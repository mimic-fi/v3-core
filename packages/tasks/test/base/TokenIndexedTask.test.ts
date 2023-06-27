import { assertEvent, deploy, deployProxy, getSigners, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

const TYPE: { [key: string]: number } = {
  DENY_LIST: 0,
  ALLOW_LIST: 1,
}

describe('TokenIndexedTask', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, registry: Contract, feeController: Contract, wrappedNT: Contract
  let owner: SignerWithAddress, mimic: SignerWithAddress, feeCollector: SignerWithAddress

  const tokenA = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  const tokenB = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  const tokenC = '0xf584F8728B874a6a5c7A8d4d387C9aae9172D621'

  before('load signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, mimic, feeCollector] = await getSigners()
  })

  before('create dependencies', async () => {
    wrappedNT = await deploy('WrappedNativeTokenMock')
    registry = await deploy('@mimic-fi/v3-registry/artifacts/contracts/Registry.sol/Registry', [mimic.address])
    feeController = await deploy('@mimic-fi/v3-fee-controller/artifacts/contracts/FeeController.sol/FeeController', [
      feeCollector.address,
      mimic.address,
    ])
  })

  beforeEach('create smart vault', async () => {
    authorizer = await deployProxy(
      '@mimic-fi/v3-authorizer/artifacts/contracts/Authorizer.sol/Authorizer',
      [],
      [[owner.address]]
    )
    smartVault = await deployProxy(
      '@mimic-fi/v3-smart-vault/artifacts/contracts/SmartVault.sol/SmartVault',
      [registry.address, feeController.address, wrappedNT.address],
      [authorizer.address, ZERO_ADDRESS, []]
    )
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'TokenIndexedTaskMock',
      [],
      [
        {
          baseConfig: {
            owner: owner.address,
            smartVault: smartVault.address,
            groupId: 0,
          },
          tokenIndexConfig: {
            tokens: [],
            sources: [],
            acceptanceType: TYPE.DENY_LIST,
          },
        },
      ]
    )
  })

  describe('setTokensAcceptanceType', () => {
    context('when the sender is allowed', () => {
      beforeEach('authorize sender', async () => {
        const setTokensAcceptanceTypeRole = task.interface.getSighash('setTokensAcceptanceType')
        await authorizer.connect(owner).authorize(owner.address, task.address, setTokensAcceptanceTypeRole, [])
        task = task.connect(owner)
      })

      const itCanBeUpdatedProperly = (type: number) => {
        it('can be updated', async () => {
          const tx = await task.setTokensAcceptanceType(type)

          expect(await task.tokensAcceptanceType()).to.be.equal(type)
          await assertEvent(tx, 'TokensAcceptanceTypeSet', { acceptanceType: type })
        })
      }

      context('when it was an allow list', () => {
        beforeEach('set allow list', async () => {
          await task.setTokensAcceptanceType(TYPE.ALLOW_LIST)
        })

        context('when updating it to an allow list', () => {
          itCanBeUpdatedProperly(TYPE.ALLOW_LIST)
        })

        context('when updating it to a deny list', () => {
          itCanBeUpdatedProperly(TYPE.DENY_LIST)
        })
      })

      context('when it was a deny list', () => {
        beforeEach('set deny list', async () => {
          await task.setTokensAcceptanceType(TYPE.DENY_LIST)
        })

        context('when updating it to an allow list', () => {
          itCanBeUpdatedProperly(TYPE.ALLOW_LIST)
        })

        context('when updating it to a deny list', () => {
          itCanBeUpdatedProperly(TYPE.DENY_LIST)
        })
      })
    })

    context('when the sender is not allowed', () => {
      it('reverts', async () => {
        await expect(task.setTokensAcceptanceType(0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setTokensAcceptanceList', () => {
    beforeEach('set allow list', async () => {
      const setTokensAcceptanceTypeRole = task.interface.getSighash('setTokensAcceptanceType')
      await authorizer.connect(owner).authorize(owner.address, task.address, setTokensAcceptanceTypeRole, [])
      await task.connect(owner).setTokensAcceptanceType(TYPE.ALLOW_LIST)
    })

    context('when the sender is allowed', () => {
      beforeEach('authorize sender', async () => {
        const setTokensAcceptanceListRole = task.interface.getSighash('setTokensAcceptanceList')
        await authorizer.connect(owner).authorize(owner.address, task.address, setTokensAcceptanceListRole, [])
        task = task.connect(owner)
      })

      context('when no address zero is given', () => {
        it('updates the list of allowed tokens', async () => {
          await task.setTokensAcceptanceList([tokenA], [true])

          expect(await task.isTokenAllowed(tokenA)).to.be.true
          expect(await task.isTokenAllowed(tokenB)).to.be.false
          expect(await task.isTokenAllowed(tokenC)).to.be.false

          await task.setTokensAcceptanceList([tokenB, tokenC, tokenA], [true, true, false])

          expect(await task.isTokenAllowed(tokenA)).to.be.false
          expect(await task.isTokenAllowed(tokenB)).to.be.true
          expect(await task.isTokenAllowed(tokenC)).to.be.true

          await task.setTokensAcceptanceList([tokenA, tokenA], [true, false])

          expect(await task.isTokenAllowed(tokenA)).to.be.false
          expect(await task.isTokenAllowed(tokenB)).to.be.true
          expect(await task.isTokenAllowed(tokenC)).to.be.true

          await task.setTokensAcceptanceList([tokenA, tokenB, tokenC], [true, true, false])

          expect(await task.isTokenAllowed(tokenA)).to.be.true
          expect(await task.isTokenAllowed(tokenB)).to.be.true
          expect(await task.isTokenAllowed(tokenC)).to.be.false
        })

        it('emits events properly', async () => {
          const tx1 = await task.setTokensAcceptanceList([tokenA], [true])

          await assertEvent(tx1, 'TokensAcceptanceListSet', { token: tokenA, added: true })

          expect(await task.isTokenAllowed(tokenA)).to.be.true
          expect(await task.isTokenAllowed(tokenB)).to.be.false
          expect(await task.isTokenAllowed(tokenC)).to.be.false

          const tx2 = await task.setTokensAcceptanceList([tokenB, tokenC, tokenA], [true, true, false])

          await assertEvent(tx2, 'TokensAcceptanceListSet', { token: tokenB, added: true })
          await assertEvent(tx2, 'TokensAcceptanceListSet', { token: tokenC, added: true })
          await assertEvent(tx2, 'TokensAcceptanceListSet', { token: tokenA, added: false })

          const tx3 = await task.setTokensAcceptanceList([tokenA, tokenA], [true, false])

          await assertEvent(tx3, 'TokensAcceptanceListSet', { token: tokenA, added: true })
          await assertEvent(tx3, 'TokensAcceptanceListSet', { token: tokenA, added: false })

          const tx4 = await task.setTokensAcceptanceList([tokenA, tokenB, tokenC], [true, true, false])

          await assertEvent(tx4, 'TokensAcceptanceListSet', { token: tokenA, added: true })
          await assertEvent(tx4, 'TokensAcceptanceListSet', { token: tokenC, added: false })
        })
      })

      context('when an address zero is given', () => {
        it('reverts', async () => {
          await expect(task.setTokensAcceptanceList([ZERO_ADDRESS], [true])).to.be.revertedWith(
            'TASK_ACCEPTANCE_TOKEN_ZERO'
          )
        })
      })
    })

    context('when the sender is not allowed', () => {
      it('reverts', async () => {
        await expect(task.setTokensAcceptanceList([], [])).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setTokensIndexSources', () => {
    let source: string

    beforeEach('set source', async () => {
      source = smartVault.address
    })

    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setTokensIndexSourcesRole = task.interface.getSighash('setTokensIndexSources')
        await authorizer.connect(owner).authorize(owner.address, task.address, setTokensIndexSourcesRole, [])
        task = task.connect(owner)
      })

      context('when the source was not allowed', async () => {
        it('can be allowed', async () => {
          const tx = await task.setTokensIndexSources([source], [true])

          expect(await task.tokensIndexSources()).to.include(source)
          await assertEvent(tx, 'TokenIndexSourceSet', { source, added: true })
        })

        it('can be disallowed', async () => {
          const tx = await task.setTokensIndexSources([source], [false])

          expect(await task.tokensIndexSources()).not.to.include(source)
          await assertEvent(tx, 'TokenIndexSourceSet', { source, added: false })
        })
      })

      context('when the source was allowed', async () => {
        beforeEach('allow source', async () => {
          await task.setTokensIndexSources([source], [true])
        })

        it('can be allowed', async () => {
          const tx = await task.setTokensIndexSources([source], [true])

          expect(await task.tokensIndexSources()).to.include(source)
          await assertEvent(tx, 'TokenIndexSourceSet', { source, added: true })
        })

        it('can be disallowed', async () => {
          const tx = await task.setTokensIndexSources([source], [false])

          expect(await task.tokensIndexSources()).not.to.include(source)
          await assertEvent(tx, 'TokenIndexSourceSet', { source, added: false })
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setTokensIndexSources([], [])).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  context('call', () => {
    beforeEach('allow owner to set tokens list', async () => {
      const setTokensAcceptanceListRole = task.interface.getSighash('setTokensAcceptanceList')
      await authorizer.connect(owner).authorize(owner.address, task.address, setTokensAcceptanceListRole, [])
    })

    describe('when validating an allow list', () => {
      beforeEach('set allow list', async () => {
        const setTokensAcceptanceTypeRole = task.interface.getSighash('setTokensAcceptanceType')
        await authorizer.connect(owner).authorize(owner.address, task.address, setTokensAcceptanceTypeRole, [])
        await task.connect(owner).setTokensAcceptanceType(TYPE.ALLOW_LIST)
      })

      it('calls tokens correctly', async () => {
        await task.connect(owner).setTokensAcceptanceList([tokenA], [true])

        expect(await task.isTokenAllowed(tokenA)).to.be.true
        expect(await task.isTokenAllowed(tokenB)).to.be.false
        expect(await task.isTokenAllowed(tokenC)).to.be.false
        await expect(task.call(tokenA)).not.to.be.reverted
        await expect(task.call(tokenB)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')
        await expect(task.call(tokenC)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')

        await task.connect(owner).setTokensAcceptanceList([tokenC], [true])

        expect(await task.isTokenAllowed(tokenA)).to.be.true
        expect(await task.isTokenAllowed(tokenB)).to.be.false
        expect(await task.isTokenAllowed(tokenC)).to.be.true
        await expect(task.call(tokenA)).not.to.be.reverted
        await expect(task.call(tokenB)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')
        await expect(task.call(tokenC)).not.to.be.reverted

        await task.connect(owner).setTokensAcceptanceList([tokenB], [true])

        expect(await task.isTokenAllowed(tokenA)).to.be.true
        expect(await task.isTokenAllowed(tokenB)).to.be.true
        expect(await task.isTokenAllowed(tokenC)).to.be.true
        await expect(task.call(tokenA)).not.to.be.reverted
        await expect(task.call(tokenB)).not.to.be.reverted
        await expect(task.call(tokenC)).not.to.be.reverted

        await task.connect(owner).setTokensAcceptanceList([tokenA], [false])
        await task.connect(owner).setTokensAcceptanceList([tokenB], [false])

        expect(await task.isTokenAllowed(tokenA)).to.be.false
        expect(await task.isTokenAllowed(tokenB)).to.be.false
        expect(await task.isTokenAllowed(tokenC)).to.be.true
        await expect(task.call(tokenA)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')
        await expect(task.call(tokenB)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')
        await expect(task.call(tokenC)).not.to.be.reverted

        await task.connect(owner).setTokensAcceptanceType(TYPE.DENY_LIST)
        await task.connect(owner).setTokensAcceptanceList([tokenA, tokenB], [true, false])

        expect(await task.isTokenAllowed(tokenA)).to.be.false
        expect(await task.isTokenAllowed(tokenB)).to.be.true
        expect(await task.isTokenAllowed(tokenC)).to.be.false
        await expect(task.call(tokenA)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')
        await expect(task.call(tokenB)).not.to.be.reverted
        await expect(task.call(tokenC)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')
      })
    })

    describe('when validating a deny list', () => {
      beforeEach('set deny list', async () => {
        const setTokensAcceptanceTypeRole = task.interface.getSighash('setTokensAcceptanceType')
        await authorizer.connect(owner).authorize(owner.address, task.address, setTokensAcceptanceTypeRole, [])
        await task.connect(owner).setTokensAcceptanceType(TYPE.DENY_LIST)
      })

      it('calls tokens correctly', async () => {
        await task.connect(owner).setTokensAcceptanceList([tokenA], [true])

        expect(await task.isTokenAllowed(tokenA)).to.be.false
        expect(await task.isTokenAllowed(tokenB)).to.be.true
        expect(await task.isTokenAllowed(tokenC)).to.be.true
        await expect(task.call(tokenA)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')
        await expect(task.call(tokenB)).not.to.be.reverted
        await expect(task.call(tokenC)).not.to.be.reverted

        await task.connect(owner).setTokensAcceptanceList([tokenC], [true])

        expect(await task.isTokenAllowed(tokenA)).to.be.false
        expect(await task.isTokenAllowed(tokenB)).to.be.true
        expect(await task.isTokenAllowed(tokenC)).to.be.false
        await expect(task.call(tokenA)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')
        await expect(task.call(tokenB)).not.to.be.reverted
        await expect(task.call(tokenC)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')

        await task.connect(owner).setTokensAcceptanceList([tokenB], [true])

        expect(await task.isTokenAllowed(tokenA)).to.be.false
        expect(await task.isTokenAllowed(tokenB)).to.be.false
        expect(await task.isTokenAllowed(tokenC)).to.be.false
        await expect(task.call(tokenA)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')
        await expect(task.call(tokenB)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')
        await expect(task.call(tokenC)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')

        await task.connect(owner).setTokensAcceptanceList([tokenA], [false])
        await task.connect(owner).setTokensAcceptanceList([tokenB], [false])

        expect(await task.isTokenAllowed(tokenA)).to.be.true
        expect(await task.isTokenAllowed(tokenB)).to.be.true
        expect(await task.isTokenAllowed(tokenC)).to.be.false
        await expect(task.call(tokenA)).not.to.be.reverted
        await expect(task.call(tokenB)).not.to.be.reverted
        await expect(task.call(tokenC)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')

        await task.connect(owner).setTokensAcceptanceType(TYPE.ALLOW_LIST)
        await task.connect(owner).setTokensAcceptanceList([tokenA, tokenB], [true, false])

        expect(await task.isTokenAllowed(tokenA)).to.be.true
        expect(await task.isTokenAllowed(tokenB)).to.be.false
        expect(await task.isTokenAllowed(tokenC)).to.be.true
        await expect(task.call(tokenA)).not.to.be.reverted
        await expect(task.call(tokenB)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')
        await expect(task.call(tokenC)).not.to.be.reverted
      })
    })
  })
})
