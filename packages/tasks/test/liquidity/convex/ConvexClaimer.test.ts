import {
  assertEvent,
  assertIndirectEvent,
  assertNoEvent,
  deploy,
  deployProxy,
  deployTokenMock,
  getSigners,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from '@mimic-fi/helpers'
import { OP } from '@mimic-fi/v3-authorizer'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment } from '../../../'
import { itBehavesLikeBaseConvexTask } from './BaseConvexTask.behavior'

describe('ConvexClaimer', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, connector: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  before('deploy connector', async () => {
    connector = await deploy('ConvexConnectorMock')
    const overrideConnectorCheckRole = smartVault.interface.getSighash('overrideConnectorCheck')
    await authorizer.connect(owner).authorize(owner.address, smartVault.address, overrideConnectorCheckRole, [])
    await smartVault.connect(owner).overrideConnectorCheck(connector.address, true)
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'ConvexClaimer',
      [],
      [
        {
          baseConvexConfig: {
            connector: connector.address,
            taskConfig: buildEmptyTaskConfig(owner, smartVault),
          },
        },
      ]
    )
  })

  describe('convex', () => {
    beforeEach('set params', async function () {
      this.owner = owner
      this.task = task
      this.authorizer = authorizer
    })

    itBehavesLikeBaseConvexTask('CONVEX_CLAIMER')
  })

  describe('call', () => {
    beforeEach('authorize task', async () => {
      const executeRole = smartVault.interface.getSighash('execute')
      const params = [{ op: OP.EQ, value: connector.address }]
      await authorizer.connect(owner).authorize(task.address, smartVault.address, executeRole, params)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = task.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, task.address, callRole, [])
        task = task.connect(owner)
      })

      context('when the token is not zero', () => {
        let token: Contract

        beforeEach('deploy token', async () => {
          token = await deployTokenMock('TKN')
        })

        context('when the amount is zero', () => {
          const amount = 0

          const itExecutesTheTaskProperly = () => {
            it('executes the expected connector', async () => {
              const tx = await task.call(token.address, amount)

              const connectorData = connector.interface.encodeFunctionData('claim', [token.address])
              await assertIndirectEvent(tx, smartVault.interface, 'Executed', { connector, data: connectorData })
              await assertIndirectEvent(tx, connector.interface, 'LogClaim', { cvxPool: token })
            })

            it('emits an Executed event', async () => {
              const tx = await task.call(token.address, amount)
              await assertEvent(tx, 'Executed')
            })
          }

          context('without balance connectors', () => {
            itExecutesTheTaskProperly()

            it('does not update any balance connectors', async () => {
              const tx = await task.call(token.address, amount)

              await assertNoEvent(tx, 'BalanceConnectorUpdated')
            })
          })

          context('with balance connectors', () => {
            const nextConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000002'

            beforeEach('set balance connectors', async () => {
              const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
              await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
              await task.connect(owner).setBalanceConnectors(ZERO_BYTES32, nextConnectorId)
            })

            beforeEach('authorize task to update balance connectors', async () => {
              const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
              await authorizer
                .connect(owner)
                .authorize(task.address, smartVault.address, updateBalanceConnectorRole, [])
            })

            itExecutesTheTaskProperly()

            it('updates the balance connectors properly', async () => {
              const tx = await task.call(token.address, amount)

              await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
                id: nextConnectorId,
                token: await connector.rewardToken(),
                amount: await connector.rewardAmount(),
                added: true,
              })
            })
          })
        })

        context('when the amount is not zero', () => {
          const amount = 1

          it('reverts', async () => {
            await expect(task.call(token.address, amount)).to.be.revertedWith('TaskAmountNotZero')
          })
        })
      })

      context('when the token is zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.call(token, 0)).to.be.revertedWith('TaskTokenZero')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(ZERO_ADDRESS, 0)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })
})
