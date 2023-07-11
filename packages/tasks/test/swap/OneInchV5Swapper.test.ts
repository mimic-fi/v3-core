import { OP } from '@mimic-fi/v3-authorizer'
import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  deployProxy,
  fp,
  getSigners,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment } from '../../src/setup'
import { itBehavesLikeBaseSwapTask } from './BaseSwapTask.behavior'

describe('OneInchV5Swapper', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, priceOracle: Contract, connector: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault, priceOracle } = await deployEnvironment(owner))
  })

  before('deploy connector', async () => {
    connector = await deploy('OneInchV5ConnectorMock')
    const overrideConnectorCheckRole = smartVault.interface.getSighash('overrideConnectorCheck')
    await authorizer.connect(owner).authorize(owner.address, smartVault.address, overrideConnectorCheckRole, [])
    await smartVault.connect(owner).overrideConnectorCheck(connector.address, true)
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'OneInchV5Swapper',
      [],
      [
        {
          baseSwapConfig: {
            connector: connector.address,
            tokenOut: ZERO_ADDRESS,
            maxSlippage: 0,
            customTokensOut: [],
            customMaxSlippages: [],
            taskConfig: buildEmptyTaskConfig(owner, smartVault),
          },
        },
      ]
    )
  })

  describe('swapper', () => {
    beforeEach('set params', async function () {
      this.owner = owner
      this.task = task
      this.authorizer = authorizer
    })

    itBehavesLikeBaseSwapTask('1INCH_V5_SWAPPER')
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

      context('when the token in is not the zero address', () => {
        let tokenIn: Contract

        beforeEach('set token in', async () => {
          tokenIn = await deploy('TokenMock', ['TKN'])
        })

        context('when the amount in is not zero', () => {
          const tokenRate = 2 // 1 token in = 2 token out
          const thresholdAmount = fp(0.1) // in token out
          const thresholdAmountInTokenIn = thresholdAmount.div(tokenRate) // threshold expressed in token in
          const amountIn = thresholdAmountInTokenIn

          context('when the token in is allowed', () => {
            context('when there is a token out set', () => {
              let tokenOut: Contract

              beforeEach('set default token out', async () => {
                tokenOut = await deploy('TokenMock', ['TKN'])
                const setDefaultTokenOutRole = task.interface.getSighash('setDefaultTokenOut')
                await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenOutRole, [])
                await task.connect(owner).setDefaultTokenOut(tokenOut.address)
              })

              beforeEach('set price feed', async () => {
                const feed = await deploy('FeedMock', [fp(tokenRate), 18])
                const setFeedRole = priceOracle.interface.getSighash('setFeed')
                await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
                await priceOracle.connect(owner).setFeed(tokenIn.address, tokenOut.address, feed.address)
              })

              beforeEach('set threshold', async () => {
                const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
                await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
                await task.connect(owner).setDefaultTokenThreshold({
                  token: tokenOut.address,
                  min: thresholdAmount,
                  max: 0,
                })
              })

              context('when the smart vault balance passes the threshold', () => {
                beforeEach('fund smart vault', async () => {
                  await tokenIn.mint(smartVault.address, amountIn)
                })

                context('when the slippage is below the limit', () => {
                  const data = '0xaabb'
                  const slippage = fp(0.01)
                  const expectedAmountOut = amountIn.mul(tokenRate)
                  const minAmountOut = expectedAmountOut.mul(fp(1).sub(slippage)).div(fp(1))

                  beforeEach('set max slippage', async () => {
                    const setDefaultMaxSlippageRole = task.interface.getSighash('setDefaultMaxSlippage')
                    await authorizer
                      .connect(owner)
                      .authorize(owner.address, task.address, setDefaultMaxSlippageRole, [])
                    await task.connect(owner).setDefaultMaxSlippage(slippage)
                  })

                  it('executes the expected connector', async () => {
                    const tx = await task.call(tokenIn.address, amountIn, slippage, data)

                    const connectorData = connector.interface.encodeFunctionData('execute', [
                      tokenIn.address,
                      tokenOut.address,
                      amountIn,
                      minAmountOut,
                      data,
                    ])

                    await assertIndirectEvent(tx, smartVault.interface, 'Executed', {
                      connector,
                      data: connectorData,
                    })

                    await assertIndirectEvent(tx, connector.interface, 'LogExecute', {
                      tokenIn,
                      tokenOut,
                      amountIn,
                      minAmountOut,
                      data,
                    })
                  })

                  it('emits an Executed event', async () => {
                    const tx = await task.call(tokenIn.address, amountIn, slippage, data)

                    await assertEvent(tx, 'Executed')
                  })

                  it('updates the balance connectors properly', async () => {
                    const nextConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000002'
                    const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
                    await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
                    await task.connect(owner).setBalanceConnectors(ZERO_BYTES32, nextConnectorId)

                    const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
                    await authorizer
                      .connect(owner)
                      .authorize(task.address, smartVault.address, updateBalanceConnectorRole, [])

                    const tx = await task.call(tokenIn.address, amountIn, slippage, data)

                    await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
                      id: nextConnectorId,
                      token: tokenOut.address,
                      amount: minAmountOut,
                      added: true,
                    })
                  })
                })

                context('when the slippage is above the limit', () => {
                  const slippage = fp(0.01)

                  it('reverts', async () => {
                    await expect(task.call(tokenIn.address, amountIn, slippage, '0x')).to.be.revertedWith(
                      'TASK_SLIPPAGE_TOO_HIGH'
                    )
                  })
                })
              })

              context('when the smart vault balance does not pass the threshold', () => {
                const amountIn = thresholdAmountInTokenIn.div(2)

                beforeEach('fund smart vault', async () => {
                  await tokenIn.mint(smartVault.address, amountIn)
                })

                it('reverts', async () => {
                  await expect(task.call(tokenIn.address, amountIn, 0, '0x')).to.be.revertedWith(
                    'TASK_TOKEN_THRESHOLD_NOT_MET'
                  )
                })
              })
            })

            context('when the token out is not set', () => {
              it('reverts', async () => {
                await expect(task.call(tokenIn.address, amountIn, 0, '0x')).to.be.revertedWith('TASK_TOKEN_OUT_NOT_SET')
              })
            })
          })

          context('when the token in is denied', () => {
            beforeEach('deny token in', async () => {
              const setTokensAcceptanceListRole = task.interface.getSighash('setTokensAcceptanceList')
              await authorizer.connect(owner).authorize(owner.address, task.address, setTokensAcceptanceListRole, [])
              await task.connect(owner).setTokensAcceptanceList([tokenIn.address], [true])
            })

            it('reverts', async () => {
              await expect(task.call(tokenIn.address, 0, 0, '0x')).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')
            })
          })
        })

        context('when the amount in is zero', () => {
          const amountIn = 0

          it('reverts', async () => {
            await expect(task.call(tokenIn.address, amountIn, 0, '0x')).to.be.revertedWith('TASK_AMOUNT_ZERO')
          })
        })
      })

      context('when the token in is the zero address', () => {
        const tokenIn = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.call(tokenIn, 0, 0, '0x')).to.be.revertedWith('TASK_TOKEN_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(ZERO_ADDRESS, 0, 0, '0x')).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
