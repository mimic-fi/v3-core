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

import { buildEmptyTaskConfig, deployEnvironment } from '../../src/setup'
import { itBehavesLikeBaseBridgeTask } from './BaseBridgeTask.behavior'

describe('WormholeBridger', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, connector: Contract
  let owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner, ] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  before('deploy connector', async () => {
    connector = await deploy('WormholeConnectorMock')
    const overrideConnectorCheckRole = smartVault.interface.getSighash('overrideConnectorCheck')
    await authorizer.connect(owner).authorize(owner.address, smartVault.address, overrideConnectorCheckRole, [])
    await smartVault.connect(owner).overrideConnectorCheck(connector.address, true)
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'WormholeBridger',
      [],
      [
        {
          baseBridgeConfig: {
            connector: connector.address,
            recipient: smartVault.address,
            destinationChain: 0,
            maxSlippage: 0,
            maxFee: {
              token: ZERO_ADDRESS,
              maxFee: 0,
            },
            customDestinationChains: [],
            customMaxSlippages: [],
            customMaxFees: [],
            taskConfig: buildEmptyTaskConfig(owner, smartVault),
          },
        },
      ]
    )
  })

  describe('bridger', () => {
    beforeEach('set params', async function () {
      this.owner = owner
      this.task = task
      this.authorizer = authorizer
    })

    itBehavesLikeBaseBridgeTask('WORMHOLE_BRIDGER')
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

      context('when the token is not the address zero', () => {
        let token: Contract

        beforeEach('deploy token', async () => {
          token = await deployTokenMock('TKN')
        })

        context('when the amount is not zero', () => {
          const amount = fp(100)
          const relayerFee = fp(35)
          const minAmountOut = amount.sub(relayerFee)
          const slippage = fp(0.35)

          context('when the destination chain was set', () => {
            const chainId = 1

            beforeEach('set destination chain ID', async () => {
              const setDefaultDestinationChainRole = task.interface.getSighash('setDefaultDestinationChain')
              await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultDestinationChainRole, [])
              await task.connect(owner).setDefaultDestinationChain(chainId)
            })

            context('when the given token is allowed', () => {
              context('when the current balance passes the threshold', () => {
                const threshold = amount

                beforeEach('set threshold', async () => {
                  const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
                  await authorizer
                    .connect(owner)
                    .authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
                  await task.connect(owner).setDefaultTokenThreshold(token.address, threshold, 0)
                })

                beforeEach('fund smart vault', async () => {
                  await token.mint(smartVault.address, amount)
                })

                context('when the slippage is below the limit', () => {
                  beforeEach('set max slippage', async () => {
                    const setDefaultMaxSlippageRole = task.interface.getSighash('setDefaultMaxSlippage')
                    await authorizer
                      .connect(owner)
                      .authorize(owner.address, task.address, setDefaultMaxSlippageRole, [])
                    await task.connect(owner).setDefaultMaxSlippage(slippage)
                  })

                  const itExecutesTheTaskProperly = (requestedAmount: BigNumberish) => {
                    it('executes the expected connector', async () => {
                      const tx = await task.call(token.address, requestedAmount, slippage)

                      const connectorData = connector.interface.encodeFunctionData('execute', [
                        chainId,
                        token.address,
                        amount,
                        minAmountOut,
                        smartVault.address,
                      ])

                      await assertIndirectEvent(tx, smartVault.interface, 'Executed', {
                        connector,
                        data: connectorData,
                      })

                      await assertIndirectEvent(tx, connector.interface, 'LogExecute', {
                        chainId,
                        token,
                        amount,
                        minAmountOut,
                        recipient: smartVault,
                      })
                    })

                    it('emits an Executed event', async () => {
                      const tx = await task.call(token.address, requestedAmount, slippage)

                      await assertEvent(tx, 'Executed')
                    })
                  }

                  context('without balance connectors', () => {
                    const requestedAmount = amount

                    itExecutesTheTaskProperly(requestedAmount)

                    it('does not update any balance connectors', async () => {
                      const tx = await task.call(token.address, requestedAmount, slippage)

                      await assertNoEvent(tx, 'BalanceConnectorUpdated')
                    })
                  })

                  context('with balance connectors', () => {
                    const requestedAmount = 0
                    const prevConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000001'

                    beforeEach('set balance connectors', async () => {
                      const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
                      await authorizer
                        .connect(owner)
                        .authorize(owner.address, task.address, setBalanceConnectorsRole, [])
                      await task.connect(owner).setBalanceConnectors(prevConnectorId, ZERO_BYTES32)
                    })

                    beforeEach('authorize task to update balance connectors', async () => {
                      const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
                      await authorizer
                        .connect(owner)
                        .authorize(task.address, smartVault.address, updateBalanceConnectorRole, [])
                    })

                    beforeEach('assign amount to previous balance connector', async () => {
                      const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
                      await authorizer
                        .connect(owner)
                        .authorize(owner.address, smartVault.address, updateBalanceConnectorRole, [])
                      await smartVault
                        .connect(owner)
                        .updateBalanceConnector(prevConnectorId, token.address, amount, true)
                    })

                    itExecutesTheTaskProperly(requestedAmount)

                    it('updates the balance connectors properly', async () => {
                      const tx = await task.call(token.address, requestedAmount, slippage)

                      await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
                        id: prevConnectorId,
                        token,
                        amount: amount,
                        added: false,
                      })
                    })
                  })
                })

                context('when the slippage is above the limit', () => {
                  it('reverts', async () => {
                    await expect(task.call(token.address, amount, slippage)).to.be.revertedWith('TaskSlippageAboveMax')
                  })
                })
              })

              context('when the current balance does not pass the threshold', () => {
                const threshold = amount.add(1)

                beforeEach('set threshold', async () => {
                  const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
                  await authorizer
                    .connect(owner)
                    .authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
                  await task.connect(owner).setDefaultTokenThreshold(token.address, threshold, 0)
                })

                it('reverts', async () => {
                  await expect(task.call(token.address, amount, slippage)).to.be.revertedWith(
                    'TaskTokenThresholdNotMet'
                  )
                })
              })
            })

            context('when the given token is not allowed', () => {
              beforeEach('deny token', async () => {
                const setTokensAcceptanceListRole = task.interface.getSighash('setTokensAcceptanceList')
                await authorizer.connect(owner).authorize(owner.address, task.address, setTokensAcceptanceListRole, [])
                await task.connect(owner).setTokensAcceptanceList([token.address], [true])
              })

              it('reverts', async () => {
                await expect(task.call(token.address, amount, slippage)).to.be.revertedWith('TaskTokenNotAllowed')
              })
            })
          })

          context('when the destination chain was not set', () => {
            it('reverts', async () => {
              await expect(task.call(token.address, amount, slippage)).to.be.revertedWith('TaskDestinationChainNotSet')
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

      context('when the token is the address zero', () => {
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
