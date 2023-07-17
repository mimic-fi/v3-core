import { OP } from '@mimic-fi/v3-authorizer'
import {
  assertEvent,
  assertIndirectEvent,
  BigNumberish,
  currentTimestamp,
  deploy,
  deployFeedMock,
  deployProxy,
  deployTokenMock,
  fp,
  getSigners,
  MINUTE,
  pct,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'
import { ethers } from 'hardhat'

import { buildEmptyTaskConfig, deployEnvironment } from '../../src/setup'
import { itBehavesLikeBaseSwapTask } from './BaseSwapTask.behavior'

describe('ParaswapV5Swapper', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, priceOracle: Contract, connector: Contract
  let owner: SignerWithAddress, quoteSigner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner, quoteSigner] = await getSigners())
    ;({ authorizer, smartVault, priceOracle } = await deployEnvironment(owner))
  })

  before('deploy connector', async () => {
    connector = await deploy('ParaswapV5ConnectorMock')
    const overrideConnectorCheckRole = smartVault.interface.getSighash('overrideConnectorCheck')
    await authorizer.connect(owner).authorize(owner.address, smartVault.address, overrideConnectorCheckRole, [])
    await smartVault.connect(owner).overrideConnectorCheck(connector.address, true)
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'ParaswapV5Swapper',
      [],
      [
        {
          quoteSigner: quoteSigner.address,
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

    itBehavesLikeBaseSwapTask('PARASWAP_V5_SWAPPER')
  })

  describe('setQuoteSigner', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setQuoteSignerRole = task.interface.getSighash('setQuoteSigner')
        await authorizer.connect(owner).authorize(owner.address, task.address, setQuoteSignerRole, [])
        task = task.connect(owner)
      })

      it('sets the quote signer', async () => {
        await task.setQuoteSigner(quoteSigner.address)

        expect(await task.quoteSigner()).to.be.equal(quoteSigner.address)
      })

      it('emits an event', async () => {
        const tx = await task.setQuoteSigner(quoteSigner.address)

        await assertEvent(tx, 'QuoteSignerSet', { quoteSigner })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setQuoteSigner(quoteSigner.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
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

      context('when the token in is not the zero address', () => {
        let tokenIn: Contract

        beforeEach('set token in', async () => {
          tokenIn = await deployTokenMock('IN')
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
                tokenOut = await deployTokenMock('OUT')
                const setDefaultTokenOutRole = task.interface.getSighash('setDefaultTokenOut')
                await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenOutRole, [])
                await task.connect(owner).setDefaultTokenOut(tokenOut.address)
              })

              beforeEach('set price feed', async () => {
                const feed = await deployFeedMock(fp(tokenRate), 18)
                const setFeedRole = priceOracle.interface.getSighash('setFeed')
                await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
                await priceOracle.connect(owner).setFeed(tokenIn.address, tokenOut.address, feed.address)
              })

              beforeEach('set threshold', async () => {
                const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
                await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
                await task.connect(owner).setDefaultTokenThreshold(tokenOut.address, thresholdAmount, 0)
              })

              context('when the smart vault balance passes the threshold', () => {
                const minAmountOut = amountIn.mul(tokenRate)

                beforeEach('fund smart vault', async () => {
                  await tokenIn.mint(smartVault.address, amountIn)
                })

                context('when the slippage is below the limit', () => {
                  const data = '0xaabb'
                  const slippage = 0.01
                  const expectedAmountOut = minAmountOut.add(pct(minAmountOut, slippage))

                  beforeEach('set max slippage', async () => {
                    const setDefaultMaxSlippageRole = task.interface.getSighash('setDefaultMaxSlippage')
                    await authorizer
                      .connect(owner)
                      .authorize(owner.address, task.address, setDefaultMaxSlippageRole, [])
                    await task.connect(owner).setDefaultMaxSlippage(fp(slippage))
                  })

                  const sign = async (
                    signer: SignerWithAddress,
                    amountIn: BigNumberish,
                    minAmountOut: BigNumberish,
                    expectedAmountOut: BigNumberish,
                    deadline: BigNumberish,
                    data: string
                  ): Promise<string> => {
                    return signer.signMessage(
                      ethers.utils.arrayify(
                        ethers.utils.solidityKeccak256(
                          ['address', 'address', 'bool', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
                          [
                            tokenIn.address,
                            tokenOut.address,
                            false,
                            amountIn,
                            minAmountOut,
                            expectedAmountOut,
                            deadline,
                            data,
                          ]
                        )
                      )
                    )
                  }

                  context('when the quote signer is set', () => {
                    beforeEach('set quote signer', async () => {
                      const setQuoteSignerRole = task.interface.getSighash('setQuoteSigner')
                      await authorizer.connect(owner).authorize(owner.address, task.address, setQuoteSignerRole, [])
                      await task.connect(owner).setQuoteSigner(quoteSigner.address)
                    })

                    context('when the deadline is in the feature', () => {
                      let deadline: BigNumber
                      let signature: string

                      beforeEach('set deadline', async () => {
                        deadline = (await currentTimestamp()).add(MINUTE)
                      })

                      beforeEach('sign data', async () => {
                        signature = await sign(quoteSigner, amountIn, minAmountOut, expectedAmountOut, deadline, data)
                      })

                      it('executes the expected connector', async () => {
                        const tx = await task.call(
                          tokenIn.address,
                          amountIn,
                          minAmountOut,
                          expectedAmountOut,
                          deadline,
                          data,
                          signature
                        )

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
                        const tx = await task.call(
                          tokenIn.address,
                          amountIn,
                          minAmountOut,
                          expectedAmountOut,
                          deadline,
                          data,
                          signature
                        )

                        await assertEvent(tx, 'Executed')
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

                        const tx = await task.call(
                          tokenIn.address,
                          amountIn,
                          minAmountOut,
                          expectedAmountOut,
                          deadline,
                          data,
                          signature
                        )

                        await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
                          id: nextConnectorId,
                          token: tokenOut.address,
                          amount: minAmountOut,
                          added: true,
                        })
                      })
                    })

                    context('when the deadline is in the past', () => {
                      let deadline: BigNumber

                      beforeEach('set deadline', async () => {
                        deadline = await currentTimestamp()
                      })

                      it('reverts', async () => {
                        const signature = await sign(
                          quoteSigner,
                          amountIn,
                          minAmountOut,
                          expectedAmountOut,
                          deadline,
                          data
                        )

                        await expect(
                          task.call(
                            tokenIn.address,
                            amountIn,
                            minAmountOut,
                            expectedAmountOut,
                            deadline,
                            data,
                            signature
                          )
                        ).to.be.revertedWith('TASK_QUOTE_SIGNER_DEADLINE')
                      })
                    })
                  })

                  context('when the quote signer is not set', () => {
                    it('reverts', async () => {
                      const signature = await sign(quoteSigner, amountIn, minAmountOut, expectedAmountOut, 0, data)

                      await expect(
                        task.call(tokenIn.address, amountIn, minAmountOut, expectedAmountOut, 0, data, signature)
                      ).to.be.revertedWith('TASK_QUOTE_SIGNER_DEADLINE')
                    })
                  })
                })

                context('when the slippage is above the limit', () => {
                  const slippage = 0.01
                  const expectedAmountOut = minAmountOut.add(pct(minAmountOut, slippage))

                  it('reverts', async () => {
                    await expect(
                      task.call(tokenIn.address, amountIn, minAmountOut, expectedAmountOut, 0, '0x', '0x')
                    ).to.be.revertedWith('TASK_SLIPPAGE_TOO_HIGH')
                  })
                })
              })

              context('when the smart vault balance does not pass the threshold', () => {
                const amountIn = thresholdAmountInTokenIn.div(2)

                beforeEach('fund smart vault', async () => {
                  await tokenIn.mint(smartVault.address, amountIn)
                })

                it('reverts', async () => {
                  await expect(task.call(tokenIn.address, amountIn, 1, 1, 0, '0x', '0x')).to.be.revertedWith(
                    'TASK_TOKEN_THRESHOLD_NOT_MET'
                  )
                })
              })
            })

            context('when the token out is not set', () => {
              it('reverts', async () => {
                await expect(task.call(tokenIn.address, amountIn, 1, 1, 0, '0x', '0x')).to.be.revertedWith(
                  'TASK_TOKEN_OUT_NOT_SET'
                )
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
              await expect(task.call(tokenIn.address, amountIn, 1, 1, 0, '0x', '0x')).to.be.revertedWith(
                'TASK_TOKEN_NOT_ALLOWED'
              )
            })
          })
        })

        context('when the amount in is zero', () => {
          const amountIn = 0

          it('reverts', async () => {
            await expect(task.call(tokenIn.address, amountIn, 1, 1, 0, '0x', '0x')).to.be.revertedWith(
              'TASK_AMOUNT_ZERO'
            )
          })
        })
      })

      context('when the token in is the zero address', () => {
        const tokenIn = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.call(tokenIn, 0, 1, 1, 0, '0x', '0x')).to.be.revertedWith('TASK_TOKEN_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(ZERO_ADDRESS, 0, 1, 1, 0, '0x', '0x')).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
