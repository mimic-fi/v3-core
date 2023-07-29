import { OP } from '@mimic-fi/v3-authorizer'
import {
  assertIndirectEvent,
  BigNumberish,
  deploy,
  deployFeedMock,
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
import { Contract, ContractTransaction } from 'ethers'
import { defaultAbiCoder } from 'ethers/lib/utils'
import { ethers } from 'hardhat'

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
          tokenIn = await deployTokenMock('TKN')
        })

        context('when the amount in is not zero', () => {
          const tokenRate = 2 // 1 token in = 2 token out
          const thresholdAmount = fp(0.1) // in token out
          const thresholdAmountInTokenIn = thresholdAmount.div(tokenRate) // threshold expressed in token in
          const amountIn = thresholdAmountInTokenIn

          context('when the token in is allowed', () => {
            context('when there is a token out set', () => {
              let tokenOut: Contract,
                extraCallData = ''

              beforeEach('set default token out', async () => {
                tokenOut = await deployTokenMock('TKN')
                const setDefaultTokenOutRole = task.interface.getSighash('setDefaultTokenOut')
                await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenOutRole, [])
                await task.connect(owner).setDefaultTokenOut(tokenOut.address)
              })

              context('when an off-chain oracle is given', () => {
                beforeEach('sign off-chain oracle', async () => {
                  const setSignerRole = priceOracle.interface.getSighash('setSigner')
                  await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setSignerRole, [])
                  await priceOracle.connect(owner).setSigner(owner.address, true)

                  type PriceData = { base: string; quote: string; rate: BigNumberish; deadline: BigNumberish }
                  const pricesData: PriceData[] = [
                    {
                      base: tokenIn.address,
                      quote: tokenOut.address,
                      rate: fp(tokenRate),
                      deadline: MAX_UINT256,
                    },
                    {
                      base: tokenOut.address,
                      quote: tokenIn.address,
                      rate: fp(1).mul(fp(1)).div(fp(tokenRate)),
                      deadline: MAX_UINT256,
                    },
                  ]

                  const PricesDataType = 'PriceData(address base, address quote, uint256 rate, uint256 deadline)[]'
                  const encodedPrices = await defaultAbiCoder.encode([PricesDataType], [pricesData])
                  const message = ethers.utils.solidityKeccak256(['bytes'], [encodedPrices])
                  const signature = await owner.signMessage(ethers.utils.arrayify(message))
                  const data = defaultAbiCoder.encode([PricesDataType, 'bytes'], [pricesData, signature]).slice(2)
                  const dataLength = defaultAbiCoder.encode(['uint256'], [data.length / 2]).slice(2)
                  extraCallData = `${data}${dataLength}`
                })

                beforeEach('set threshold', async () => {
                  const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
                  await authorizer
                    .connect(owner)
                    .authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
                  await task.connect(owner).setDefaultTokenThreshold(tokenOut.address, thresholdAmount, 0)
                })

                const executeTask = async (amountIn, slippage, data): Promise<ContractTransaction> => {
                  const callTx = await task.populateTransaction.call(tokenIn.address, amountIn, slippage, data)
                  const callData = `${callTx.data}${extraCallData}`
                  return owner.sendTransaction({ to: task.address, data: callData })
                }

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
                      const tx = await executeTask(amountIn, slippage, data)

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
                      const tx = await executeTask(amountIn, slippage, data)

                      await assertIndirectEvent(tx, task.interface, 'Executed')
                    })

                    it('updates the balance connectors properly', async () => {
                      const nextConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000002'
                      const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
                      await authorizer
                        .connect(owner)
                        .authorize(owner.address, task.address, setBalanceConnectorsRole, [])
                      await task.connect(owner).setBalanceConnectors(ZERO_BYTES32, nextConnectorId)

                      const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
                      await authorizer
                        .connect(owner)
                        .authorize(task.address, smartVault.address, updateBalanceConnectorRole, [])

                      const tx = await executeTask(amountIn, slippage, data)

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
                      await expect(executeTask(amountIn, slippage, '0x')).to.be.revertedWith('TaskSlippageAboveMax')
                    })
                  })
                })

                context('when the smart vault balance does not pass the threshold', () => {
                  const amountIn = thresholdAmountInTokenIn.div(2)

                  beforeEach('fund smart vault', async () => {
                    await tokenIn.mint(smartVault.address, amountIn)
                  })

                  it('reverts', async () => {
                    await expect(executeTask(amountIn, 0, '0x')).to.be.revertedWith('TaskTokenThresholdNotMet')
                  })
                })
              })

              context('when no off-chain oracle is given', () => {
                context('when an on-chain oracle is given', () => {
                  beforeEach('set price feed', async () => {
                    const feed = await deployFeedMock(fp(tokenRate), 18)
                    const setFeedRole = priceOracle.interface.getSighash('setFeed')
                    await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
                    await priceOracle.connect(owner).setFeed(tokenIn.address, tokenOut.address, feed.address)
                  })

                  beforeEach('set threshold', async () => {
                    const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
                    await authorizer
                      .connect(owner)
                      .authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
                    await task.connect(owner).setDefaultTokenThreshold(tokenOut.address, thresholdAmount, 0)
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

                        await assertIndirectEvent(tx, task.interface, 'Executed')
                      })
                    })

                    context('when the slippage is above the limit', () => {
                      const slippage = fp(0.01)

                      it('reverts', async () => {
                        await expect(task.call(tokenIn.address, amountIn, slippage, '0x')).to.be.revertedWith(
                          'TaskSlippageAboveMax'
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
                        'TaskTokenThresholdNotMet'
                      )
                    })
                  })
                })

                context('when no on-chain oracle is given', () => {
                  it('reverts', async () => {
                    // TODO: Hardhat does not decode price oracle error properly
                    await expect(task.call(tokenIn.address, amountIn, 0, '0x')).to.be.reverted
                  })
                })
              })
            })

            context('when the token out is not set', () => {
              it('reverts', async () => {
                await expect(task.call(tokenIn.address, amountIn, 0, '0x')).to.be.revertedWith('TaskTokenOutNotSet')
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
              await expect(task.call(tokenIn.address, 0, 0, '0x')).to.be.revertedWith('TaskTokenNotAllowed')
            })
          })
        })

        context('when the amount in is zero', () => {
          const amountIn = 0

          it('reverts', async () => {
            await expect(task.call(tokenIn.address, amountIn, 0, '0x')).to.be.revertedWith('TaskAmountZero')
          })
        })
      })

      context('when the token in is the zero address', () => {
        const tokenIn = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.call(tokenIn, 0, 0, '0x')).to.be.revertedWith('TaskTokenZero')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(ZERO_ADDRESS, 0, 0, '0x')).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })
})
