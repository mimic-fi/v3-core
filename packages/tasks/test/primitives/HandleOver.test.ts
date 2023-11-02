import {
  assertEvent,
  assertIndirectEvent,
  deployProxy,
  deployTokenMock,
  fp,
  getSigners,
  ZERO_BYTES32,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'
import { ethers } from 'hardhat'

import { buildEmptyTaskConfig, deployEnvironment } from '../../src/setup'

describe('HandleOver', () => {
  const PREVIOUS = '0x0000000000000000000000000000000000000000000000000000000000000001'
  const NEXT = '0x0000000000000000000000000000000000000000000000000000000000000002'

  let task: Contract
  let smartVault: Contract, authorizer: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  beforeEach('deploy task', async () => {
    const taskConfig = buildEmptyTaskConfig(owner, smartVault)
    taskConfig.baseConfig.previousBalanceConnectorId = PREVIOUS
    taskConfig.baseConfig.nextBalanceConnectorId = NEXT
    task = await deployProxy('HandleOver', [], [{ taskConfig }])
  })

  describe('execution type', () => {
    it('defines it correctly', async () => {
      const expectedType = ethers.utils.solidityKeccak256(['string'], ['HANDLE_OVER'])
      expect(await task.EXECUTION_TYPE()).to.be.equal(expectedType)
    })
  })

  describe('setBalanceConnectors', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
        await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
        task = task.connect(owner)
      })

      const itCanBeSet = (previous: string, next: string) => {
        it('can be set', async () => {
          const tx = await task.setBalanceConnectors(previous, next)

          const connectors = await task.getBalanceConnectors()
          expect(connectors.previous).to.be.equal(previous)
          expect(connectors.next).to.be.equal(next)

          await assertEvent(tx, 'BalanceConnectorsSet', { previous, next })
        })
      }

      context('when setting next to non-zero', () => {
        const next = NEXT

        context('when setting previous to zero', () => {
          const previous = PREVIOUS

          itCanBeSet(previous, next)
        })

        context('when setting previous to non-zero', () => {
          const previous = ZERO_BYTES32

          it('reverts', async () => {
            await expect(task.setBalanceConnectors(previous, next)).to.be.revertedWith('TaskConnectorZero')
          })
        })
      })

      context('when setting next to zero', () => {
        const next = ZERO_BYTES32

        context('when setting previous to zero', () => {
          const previous = ZERO_BYTES32

          it('reverts', async () => {
            await expect(task.setBalanceConnectors(previous, next)).to.be.revertedWith('TaskConnectorZero')
          })
        })

        context('when setting previous to non-zero', () => {
          const previous = PREVIOUS

          it('reverts', async () => {
            await expect(task.setBalanceConnectors(previous, next)).to.be.revertedWith('TaskConnectorZero')
          })
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setBalanceConnectors(ZERO_BYTES32, ZERO_BYTES32)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('call', () => {
    let token: Contract
    const amount = fp(20)

    beforeEach('deploy token', async () => {
      token = await deployTokenMock('USDC')
      await token.mint(smartVault.address, amount)
    })

    beforeEach('update previous balance connector', async () => {
      const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
      await authorizer.connect(owner).authorize(owner.address, smartVault.address, updateBalanceConnectorRole, [])
      await smartVault.connect(owner).updateBalanceConnector(PREVIOUS, token.address, amount, true)
    })

    beforeEach('authorize task to update balance connectors', async () => {
      const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
      await authorizer.connect(owner).authorize(task.address, smartVault.address, updateBalanceConnectorRole, [])
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = task.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, task.address, callRole, [])
        task = task.connect(owner)
      })

      const itExecutesTheTaskProperly = (requestedAmount: BigNumber) => {
        it('emits an Executed event', async () => {
          const tx = await task.call(token.address, requestedAmount)

          await assertEvent(tx, 'Executed')
        })

        it('updates the balance connectors properly', async () => {
          const transactedAmount = requestedAmount.eq(fp(0)) ? amount : requestedAmount

          const tx = await task.call(token.address, requestedAmount)

          await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
            id: PREVIOUS,
            token,
            amount: transactedAmount,
            added: false,
          })

          await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
            id: NEXT,
            token,
            amount: transactedAmount,
            added: true,
          })
        })
      }

      context('when requesting a specific amount', () => {
        const requestedAmount = fp(0)

        itExecutesTheTaskProperly(requestedAmount)
      })

      context('when requesting a specific amount', () => {
        const requestedAmount = amount.div(2)

        itExecutesTheTaskProperly(requestedAmount)
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(token.address, 0)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })
})
