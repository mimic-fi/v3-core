import {
  assertEvent,
  assertIndirectEvent,
  assertNoEvent,
  BigNumberish,
  deploy,
  deployProxy,
  deployTokenMock,
  fp,
  getSigners,
  ZERO_ADDRESS,
} from '@mimic-fi/helpers'
import { OP } from '@mimic-fi/v3-authorizer'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment } from '../../../'
import { itBehavesLikeBaseConvexTask } from './BaseConvexTask.behavior'

describe('ConvexExiter', () => {
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
      'ConvexExiter',
      [],
      [
        {
          baseConvexConfig: {
            connector: connector.address,
            maxSlippage: 0,
            customMaxSlippages: [],
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

    itBehavesLikeBaseConvexTask('CONVEX_EXITER')
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
        let token: Contract, tokenOut: Contract

        beforeEach('deploy token', async () => {
          token = await deployTokenMock('cvx2CRV')
        })

        beforeEach('set connector tokens', async () => {
          tokenOut = await deployTokenMock('2CRV')
          await connector.setCvxPool(tokenOut.address, token.address)
          await connector.setCurvePool(token.address, tokenOut.address)
        })

        context('when the amount is not zero', () => {
          const amount = fp(10)

          beforeEach('fund smart vault', async () => {
            await token.mint(smartVault.address, amount)
          })

          context('when the threshold has passed', () => {
            const threshold = fp(10)

            beforeEach('set token threshold', async () => {
              const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
              await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
              await task.connect(owner).setDefaultTokenThreshold(token.address, threshold, 0)
            })

            const itExecutesTheTaskProperly = (requestedAmount: BigNumberish) => {
              it('executes the expected connector', async () => {
                const tx = await task.call(token.address, requestedAmount)

                const connectorData = connector.interface.encodeFunctionData('exit', [token.address, amount])
                await assertIndirectEvent(tx, smartVault.interface, 'Executed', { connector, data: connectorData })
                await assertIndirectEvent(tx, connector.interface, 'LogExit', { cvxPool: token, amount })
              })

              it('emits an Executed event', async () => {
                const tx = await task.call(token.address, requestedAmount)
                await assertEvent(tx, 'Executed')
              })
            }

            context('without balance connectors', () => {
              const requestedAmount = amount

              itExecutesTheTaskProperly(requestedAmount)

              it('does not update any balance connectors', async () => {
                const tx = await task.call(token.address, requestedAmount)

                await assertNoEvent(tx, 'BalanceConnectorUpdated')
              })
            })

            context('with balance connectors', () => {
              const requestedAmount = 0
              const prevConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000001'
              const nextConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000002'

              beforeEach('set balance connectors', async () => {
                const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
                await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
                await task.connect(owner).setBalanceConnectors(prevConnectorId, nextConnectorId)
              })

              beforeEach('authorize task to update balance connectors', async () => {
                const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
                await authorizer
                  .connect(owner)
                  .authorize(task.address, smartVault.address, updateBalanceConnectorRole, [])
              })

              beforeEach('assign amount in to previous balance connector', async () => {
                const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
                await authorizer
                  .connect(owner)
                  .authorize(owner.address, smartVault.address, updateBalanceConnectorRole, [])
                await smartVault.connect(owner).updateBalanceConnector(prevConnectorId, token.address, amount, true)
              })

              itExecutesTheTaskProperly(requestedAmount)

              it('updates the balance connectors properly', async () => {
                const tx = await task.call(token.address, requestedAmount)

                await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
                  id: prevConnectorId,
                  token,
                  amount,
                  added: false,
                })

                await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
                  id: nextConnectorId,
                  token: tokenOut.address,
                  amount,
                  added: true,
                })
              })
            })
          })

          context('when the threshold has not passed', () => {
            const threshold = amount.add(1)

            beforeEach('set token threshold', async () => {
              const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
              await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
              await task.connect(owner).setDefaultTokenThreshold(token.address, threshold, 0)
            })

            it('reverts', async () => {
              await expect(task.call(token.address, amount)).to.be.revertedWith('TaskTokenThresholdNotMet')
            })
          })
        })

        context('when the amount is zero', () => {
          const amount = 0

          it('reverts', async () => {
            await expect(task.call(token.address, amount)).to.be.revertedWith('TaskAmountZero')
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
