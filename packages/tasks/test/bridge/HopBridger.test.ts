import { OP } from '@mimic-fi/v3-authorizer'
import {
  assertEvent,
  assertIndirectEvent,
  assertNoEvent,
  BigNumberish,
  currentTimestamp,
  deploy,
  deployProxy,
  deployTokenMock,
  fp,
  getSigners,
  MAX_UINT256,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment } from '../../src/setup'
import { itBehavesLikeBaseBridgeTask } from './BaseBridgeTask.behavior'

describe('HopBridger', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, connector: Contract
  let owner: SignerWithAddress, relayer: SignerWithAddress, entrypoint: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner, relayer, entrypoint] = await getSigners(4,))
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  before('deploy connector', async () => {
    connector = await deploy('HopBridgeConnectorMock')
    const overrideConnectorCheckRole = smartVault.interface.getSighash('overrideConnectorCheck')
    await authorizer.connect(owner).authorize(owner.address, smartVault.address, overrideConnectorCheckRole, [])
    await smartVault.connect(owner).overrideConnectorCheck(connector.address, true)
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'HopBridger',
      [],
      [
        {
          relayer: relayer.address,
          maxDeadline: MAX_UINT256.div(10),
          tokenHopEntrypoints: [],
          baseBridgeConfig: {
            connector: connector.address,
            recipient: smartVault.address,
            destinationChain: 0,
            maxSlippage: 0,
            maxFee: {
              token: ZERO_ADDRESS,
              amount: 0,
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

    itBehavesLikeBaseBridgeTask('HOP_BRIDGER')
  })

  describe('setRelayer', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setRelayerRole = task.interface.getSighash('setRelayer')
        await authorizer.connect(owner).authorize(owner.address, task.address, setRelayerRole, [])
        task = task.connect(owner)
      })

      it('sets the relayer', async () => {
        await task.setRelayer(relayer.address)

        expect(await task.relayer()).to.be.equal(relayer.address)
      })

      it('emits an event', async () => {
        const tx = await task.setRelayer(relayer.address)

        await assertEvent(tx, 'RelayerSet', { relayer: relayer })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setRelayer(ZERO_ADDRESS)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('setMaxDeadline', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setMaxDeadlineRole = task.interface.getSighash('setMaxDeadline')
        await authorizer.connect(owner).authorize(owner.address, task.address, setMaxDeadlineRole, [])
        task = task.connect(owner)
      })

      const itSetsTheMaxDeadlineProperly = (deadline: number) => {
        it('sets the max deadline', async () => {
          await task.setMaxDeadline(deadline)

          expect(await task.maxDeadline()).to.be.equal(deadline)
        })

        it('emits an event', async () => {
          const tx = await task.setMaxDeadline(deadline)

          await assertEvent(tx, 'MaxDeadlineSet', { maxDeadline: deadline })
        })
      }

      context('when the deadline is not zero', () => {
        const deadline = 60 * 60

        itSetsTheMaxDeadlineProperly(deadline)
      })

      context('when the deadline is zero', () => {
        const deadline = 0

        itSetsTheMaxDeadlineProperly(deadline)
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setMaxDeadline(1)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('setTokenHopEntrypoint', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setTokenHopEntrypointRole = task.interface.getSighash('setTokenHopEntrypoint')
        await authorizer.connect(owner).authorize(owner.address, task.address, setTokenHopEntrypointRole, [])
        task = task.connect(owner)
      })

      context('when the token address is not zero', () => {
        let token: Contract

        beforeEach('deploy token', async () => {
          token = await deployTokenMock('TKN')
        })

        context('when setting the Hop entrypoint', () => {
          const itSetsTheHopEntrypoint = () => {
            it('sets the Hop entrypoint', async () => {
              await task.setTokenHopEntrypoint(token.address, entrypoint.address)

              const hopEntrypoint = await task.tokenHopEntrypoint(token.address)
              expect(hopEntrypoint).to.be.equal(entrypoint.address)
            })

            it('emits an event', async () => {
              const tx = await task.setTokenHopEntrypoint(token.address, entrypoint.address)

              await assertEvent(tx, 'TokenHopEntrypointSet', { token, entrypoint })
            })
          }

          context('when the Hop entrypoint was set', () => {
            beforeEach('set Hop entrypoint', async () => {
              await task.setTokenHopEntrypoint(token.address, entrypoint.address)
            })

            itSetsTheHopEntrypoint()
          })

          context('when the Hop entrypoint was not set', () => {
            beforeEach('unset Hop entrypoint', async () => {
              await task.setTokenHopEntrypoint(token.address, ZERO_ADDRESS)
            })

            itSetsTheHopEntrypoint()
          })
        })

        context('when unsetting the Hop entrypoint', () => {
          const entrypoint = ZERO_ADDRESS

          const itUnsetsTheHopEntrypoint = () => {
            it('unsets the Hop entrypoint', async () => {
              await task.setTokenHopEntrypoint(token.address, entrypoint)

              const hopEntrypoint = await task.tokenHopEntrypoint(token.address)
              expect(hopEntrypoint).to.be.equal(entrypoint)
            })

            it('emits an event', async () => {
              const tx = await task.setTokenHopEntrypoint(token.address, entrypoint)

              await assertEvent(tx, 'TokenHopEntrypointSet', { token, entrypoint })
            })
          }

          context('when the Hop entrypoint was set', () => {
            beforeEach('set Hop entrypoint', async () => {
              await task.setTokenHopEntrypoint(token.address, token.address)
            })

            itUnsetsTheHopEntrypoint()
          })

          context('when the token was not set', () => {
            beforeEach('unset Hop entrypoint', async () => {
              await task.setTokenHopEntrypoint(token.address, entrypoint)
            })

            itUnsetsTheHopEntrypoint()
          })
        })
      })

      context('when the token address is zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.setTokenHopEntrypoint(token, ZERO_ADDRESS)).to.be.revertedWith('TaskTokenZero')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setTokenHopEntrypoint(ZERO_ADDRESS, ZERO_ADDRESS)).to.be.revertedWith('AuthSenderNotAllowed')
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
      beforeEach('authorize sender', async () => {
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
          const fee = fp(1)
          const slippage = fp(0.05)

          context('when the destination chain was set', () => {
            const itExecutesProperlyForChain = (chainId: number) => {
              beforeEach('set destination chain ID', async () => {
                const setDefaultDestinationChainRole = task.interface.getSighash('setDefaultDestinationChain')
                await authorizer
                  .connect(owner)
                  .authorize(owner.address, task.address, setDefaultDestinationChainRole, [])
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

                  beforeEach('set token hop entrypoint', async () => {
                    const setTokenHopEntrypointRole = task.interface.getSighash('setTokenHopEntrypoint')
                    await authorizer
                      .connect(owner)
                      .authorize(owner.address, task.address, setTokenHopEntrypointRole, [])
                    await task.connect(owner).setTokenHopEntrypoint(token.address, entrypoint.address)
                  })

                  context('when the slippage is below the limit', () => {
                    beforeEach('set max slippage', async () => {
                      const setDefaultMaxSlippageRole = task.interface.getSighash('setDefaultMaxSlippage')
                      await authorizer
                        .connect(owner)
                        .authorize(owner.address, task.address, setDefaultMaxSlippageRole, [])
                      await task.connect(owner).setDefaultMaxSlippage(slippage)
                    })

                    const itExecutesTheTaskProperly = (requestedAmount: BigNumberish, fee: BigNumberish) => {
                      it('executes the expected connector', async () => {
                        const tx = await task.call(token.address, requestedAmount, slippage, fee)

                        const deadline = chainId == 1 ? 0 : (await currentTimestamp()).add(MAX_UINT256.div(10))
                        const amountAfterFees = amount.sub(fee)
                        const minAmountOut = amountAfterFees.mul(fp(1).sub(slippage)).div(fp(1))

                        const connectorData = connector.interface.encodeFunctionData('execute', [
                          chainId,
                          token.address,
                          amount,
                          minAmountOut,
                          smartVault.address,
                          entrypoint.address,
                          deadline,
                          relayer.address,
                          fee,
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
                          bridge: entrypoint,
                          deadline,
                          relayer,
                          fee,
                        })
                      })

                      it('emits an Executed event', async () => {
                        const tx = await task.call(token.address, requestedAmount, slippage, fee)

                        await assertEvent(tx, 'Executed')
                      })
                    }

                    context('when the max fee is set', () => {
                      beforeEach('set max fee', async () => {
                        const setDefaultMaxFeeRole = task.interface.getSighash('setDefaultMaxFee')
                        await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultMaxFeeRole, [])
                        await task.connect(owner).setDefaultMaxFee(token.address, fee)
                      })

                      context('when the given fee is below the limit', () => {
                        context('without balance connectors', () => {
                          const requestedAmount = amount

                          itExecutesTheTaskProperly(requestedAmount, fee)

                          it('does not update any balance connectors', async () => {
                            const tx = await task.call(token.address, requestedAmount, slippage, fee)

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

                          itExecutesTheTaskProperly(requestedAmount, fee)

                          it('updates the balance connectors properly', async () => {
                            const tx = await task.call(token.address, amount, slippage, fee)

                            await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
                              id: prevConnectorId,
                              token,
                              amount: amount,
                              added: false,
                            })
                          })
                        })
                      })

                      context('when the given fee is above the limit', () => {
                        const highFee = fee.add(1)

                        it('reverts', async () => {
                          await expect(task.call(token.address, amount, 0, highFee)).to.be.revertedWith(
                            'TaskFeeAboveMax'
                          )
                        })
                      })
                    })

                    context('when the max fee is not set', () => {
                      context('when the given fee is zero', () => {
                        const fee = 0

                        itExecutesTheTaskProperly(amount, fee)
                      })

                      context('when the given fee is not zero', () => {
                        it('reverts', async () => {
                          await expect(task.call(token.address, amount, slippage, fee)).to.be.revertedWith(
                            'TaskFeeAboveMax'
                          )
                        })
                      })
                    })
                  })

                  context('when the slippage is above the limit', () => {
                    it('reverts', async () => {
                      await expect(task.call(token.address, amount, slippage, 0)).to.be.revertedWith(
                        'TaskSlippageAboveMax'
                      )
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
                    await expect(task.call(token.address, amount, slippage, fee)).to.be.revertedWith(
                      'TaskTokenThresholdNotMet'
                    )
                  })
                })
              })

              context('when the given token is not allowed', () => {
                beforeEach('deny token', async () => {
                  const setTokensAcceptanceListRole = task.interface.getSighash('setTokensAcceptanceList')
                  await authorizer
                    .connect(owner)
                    .authorize(owner.address, task.address, setTokensAcceptanceListRole, [])
                  await task.connect(owner).setTokensAcceptanceList([token.address], [true])
                })

                it('reverts', async () => {
                  await expect(task.call(token.address, amount, slippage, fee)).to.be.revertedWith(
                    'TaskTokenNotAllowed'
                  )
                })
              })
            }

            context('when the bridging to a L1', () => {
              const chainId = 1

              itExecutesProperlyForChain(chainId)
            })

            context('when the bridging to a L2', () => {
              const chainId = 137

              itExecutesProperlyForChain(chainId)
            })
          })

          context('when the destination chain was not set', () => {
            it('reverts', async () => {
              await expect(task.call(token.address, amount, slippage, fee)).to.be.revertedWith(
                'TaskDestinationChainNotSet'
              )
            })
          })
        })

        context('when the amount is zero', () => {
          const amount = 0

          it('reverts', async () => {
            await expect(task.call(token.address, amount, 0, 0)).to.be.revertedWith('TaskAmountZero')
          })
        })
      })

      context('when the token is the address zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.call(token, 0, 0, 0)).to.be.revertedWith('TaskTokenZero')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(ZERO_ADDRESS, 0, 0, 0)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })
})
