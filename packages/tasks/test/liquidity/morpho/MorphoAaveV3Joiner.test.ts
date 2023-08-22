import { OP } from '@mimic-fi/v3-authorizer'
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
  ZERO_BYTES32,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment } from '../../../dist'
import { itBehavesLikeBaseMorphoAaveV3Task } from './BaseMorphoAaveV3Task.behavior'

describe('MorphoAaveV3Joiner', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, connector: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  before('deploy connector', async () => {
    connector = await deploy('MorphoAaveV3ConnectorMock')
    const overrideConnectorCheckRole = smartVault.interface.getSighash('overrideConnectorCheck')
    await authorizer.connect(owner).authorize(owner.address, smartVault.address, overrideConnectorCheckRole, [])
    await smartVault.connect(owner).overrideConnectorCheck(connector.address, true)
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'MorphoAaveV3Joiner',
      [],
      [
        {
          maxIterationsLimit: 0,
          customMaxIterationsLimits: [],
          baseMorphoAaveV3Config: {
            connector: connector.address,
            taskConfig: buildEmptyTaskConfig(owner, smartVault),
          },
        },
      ]
    )
  })

  describe('morpho-aave V3', () => {
    beforeEach('set params', async function () {
      this.owner = owner
      this.task = task
      this.authorizer = authorizer
    })

    itBehavesLikeBaseMorphoAaveV3Task('MORPHO_AAVE_V3_JOINER')
  })

  describe('setDefaultMaxIterationsLimit', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async function () {
        const setDefaultMaxIterationsLimitRole = task.interface.getSighash('setDefaultMaxIterationsLimit')
        await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultMaxIterationsLimitRole, [])
        task = task.connect(owner)
      })

      const maxIterations = 4

      it('sets the max iterations limit', async function () {
        await task.setDefaultMaxIterationsLimit(maxIterations)

        expect(await task.defaultMaxIterationsLimit()).to.be.equal(maxIterations)
      })

      it('emits an event', async function () {
        const tx = await task.setDefaultMaxIterationsLimit(maxIterations)

        await assertEvent(tx, 'DefaultMaxIterationsLimitSet', { maxIterationsLimit: maxIterations })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(task.setDefaultMaxIterationsLimit(1)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('setCustomMaxIterationsLimit', () => {
    let token: Contract

    beforeEach('deploy token', async function () {
      token = await deployTokenMock('TKN')
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async function () {
        const setCustomMaxIterationsLimitRole = task.interface.getSighash('setCustomMaxIterationsLimit')
        await authorizer.connect(owner).authorize(owner.address, task.address, setCustomMaxIterationsLimitRole, [])
        task = task.connect(owner)
      })

      const maxIterations = 4

      it('sets the max iterations limit', async function () {
        await task.setCustomMaxIterationsLimit(token.address, maxIterations)

        expect(await task.customMaxIterationsLimit(token.address)).to.be.equal(maxIterations)
      })

      it('emits an event', async function () {
        const tx = await task.setCustomMaxIterationsLimit(token.address, maxIterations)

        await assertEvent(tx, 'CustomMaxIterationsLimitSet', { token, maxIterationsLimit: maxIterations })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(task.setCustomMaxIterationsLimit(ZERO_ADDRESS, 0)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
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
          token = await deployTokenMock('WETH')
        })

        context('when the amount is not zero', () => {
          const amount = fp(10)

          context('when the max iterations is below the limit', () => {
            const maxIterations = 4

            beforeEach('set max iterations limit', async () => {
              const setDefaultMaxIterationsLimitRole = task.interface.getSighash('setDefaultMaxIterationsLimit')
              await authorizer
                .connect(owner)
                .authorize(owner.address, task.address, setDefaultMaxIterationsLimitRole, [])
              await task.connect(owner).setDefaultMaxIterationsLimit(maxIterations)
            })

            beforeEach('fund smart vault', async () => {
              await token.mint(smartVault.address, amount)
            })

            context('when the threshold has passed', () => {
              const threshold = amount

              beforeEach('set token threshold', async () => {
                const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
                await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
                await task.connect(owner).setDefaultTokenThreshold(token.address, threshold, 0)
              })

              const itExecutesTheTaskProperly = (requestedAmount: BigNumberish) => {
                it('executes the expected connector', async () => {
                  const tx = await task.call(token.address, requestedAmount, maxIterations)

                  const connectorData = connector.interface.encodeFunctionData('join', [
                    token.address,
                    amount,
                    maxIterations,
                  ])
                  await assertIndirectEvent(tx, smartVault.interface, 'Executed', { connector, data: connectorData })
                  await assertIndirectEvent(tx, connector.interface, 'LogJoin', { token, amount })
                })

                it('emits an Executed event', async () => {
                  const tx = await task.call(token.address, requestedAmount, maxIterations)
                  await assertEvent(tx, 'Executed')
                })
              }

              context('without balance connectors', () => {
                const requestedAmount = amount

                itExecutesTheTaskProperly(requestedAmount)

                it('does not update any balance connectors', async () => {
                  const tx = await task.call(token.address, requestedAmount, maxIterations)

                  await assertNoEvent(tx, 'BalanceConnectorUpdated')
                })
              })

              context('with balance connectors', () => {
                const requestedAmount = 0
                const prevConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000001'

                beforeEach('set balance connectors', async () => {
                  const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
                  await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
                  await task.connect(owner).setBalanceConnectors(prevConnectorId, ZERO_BYTES32)
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
                  const tx = await task.call(token.address, amount, maxIterations)

                  await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
                    id: prevConnectorId,
                    token,
                    amount,
                    added: false,
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
                await expect(task.call(token.address, amount, maxIterations)).to.be.revertedWith(
                  'TaskTokenThresholdNotMet'
                )
              })
            })
          })

          context('when the max iterations is above the limit', () => {
            const maxIterations = 5

            it('reverts', async () => {
              await expect(task.call(token.address, amount, maxIterations)).to.be.revertedWith(
                'TaskMaxIterationsLimitAboveMax'
              )
            })
          })
        })

        context('when the amount is zero', () => {
          const amount = 0

          it('reverts', async () => {
            await expect(task.call(token.address, amount, 0)).to.be.revertedWith('TaskAmountZero')
          })
        })
      })

      context('when the token is zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.call(token, 0, 0)).to.be.revertedWith('TaskTokenZero')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(ZERO_ADDRESS, 0, 0)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })
})
