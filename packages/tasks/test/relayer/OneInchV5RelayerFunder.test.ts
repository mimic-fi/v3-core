import { OP } from '@mimic-fi/v3-authorizer'
import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  deployFeedMock,
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
import { itBehavesLikeBaseRelayerFundTask } from './BaseRelayerFundTask.behavior'

/* eslint-disable no-secrets/no-secrets */

describe('OneInchV5RelayerFunder', () => {
  let task: Contract, relayer: Contract
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

  before('deploy relayer', async () => {
    relayer = await deploy('RelayerMock', [])
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'OneInchV5RelayerFunder',
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
        relayer.address,
      ],
      'initializeOneInchV5RelayerFunder'
    )
  })

  describe('initialization', async () => {
    it('cannot call parent initialize', async () => {
      await expect(
        task.initialize({
          baseSwapConfig: {
            connector: connector.address,
            tokenOut: ZERO_ADDRESS,
            maxSlippage: 0,
            customTokensOut: [],
            customMaxSlippages: [],
            taskConfig: buildEmptyTaskConfig(owner, smartVault),
          },
        })
      ).to.be.revertedWith('TaskInitializerDisabled')
    })

    it('has a relayer reference', async () => {
      expect(await task.relayer()).to.be.equal(relayer.address)
    })
  })

  describe('relayer funder', () => {
    beforeEach('set params', async function () {
      this.owner = owner
      this.task = task
      this.authorizer = authorizer
      this.priceOracle = priceOracle
      this.smartVault = smartVault
      this.relayer = relayer
    })

    itBehavesLikeBaseRelayerFundTask('1INCH_V5_SWAPPER')
  })

  describe('1inch v5 swappper', () => {
    beforeEach('authorize task', async () => {
      const executeRole = smartVault.interface.getSighash('execute')
      const params = [{ op: OP.EQ, value: connector.address }]
      await authorizer.connect(owner).authorize(task.address, smartVault.address, executeRole, params)
    })

    context('when the sender is authorized', () => {
      let tokenIn: Contract, wrappedNT: Contract

      beforeEach('set sender', async () => {
        const callRole = task.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, task.address, callRole, [])
        task = task.connect(owner)
      })

      beforeEach('set token in', async () => {
        tokenIn = await deployTokenMock('TKN')
      })

      before('set wrapped native token', async function () {
        wrappedNT = await smartVault.wrappedNativeToken()
      })

      context('when the token in is not the zero address', () => {
        context('when the amount in is not zero', () => {
          const tokenRate = 2 // 1 token in = 2 token out
          const thresholdMin = fp(100) // in token out
          const thresholdMax = fp(1000) // in token out
          const thresholdMinInTokenIn = thresholdMin.div(tokenRate)
          const thresholdMaxInTokenIn = thresholdMax.div(tokenRate)
          const amountIn = thresholdMinInTokenIn
          const tokenInNativeRate = 2 // 2 token in = 1 native
          const tokenOutNativeRate = 1 // 1 token out = 1 native

          context('when the token in is allowed', () => {
            context('when there is a token out set', () => {
              let tokenOut: Contract

              beforeEach('set default token out', async () => {
                tokenOut = await deployTokenMock('TKN')
                const setDefaultTokenOutRole = task.interface.getSighash('setDefaultTokenOut')
                await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenOutRole, [])
                await task.connect(owner).setDefaultTokenOut(tokenOut.address)
              })

              beforeEach('set price feed', async function () {
                const feed = await deployFeedMock(fp(tokenOutNativeRate), 18)
                const setFeedRole = priceOracle.interface.getSighash('setFeed')
                await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
                await priceOracle.connect(owner).setFeed(wrappedNT, tokenOut.address, feed.address)
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
                await task.connect(owner).setDefaultTokenThreshold(tokenOut.address, thresholdMin, thresholdMax)
              })

              context('when the balance is below the min threshold', () => {
                beforeEach('fund smart vault', async () => {
                  await tokenIn.mint(smartVault.address, amountIn)
                })

                beforeEach('set smart vault balance in relayer', async function () {
                  const balance = await relayer.getSmartVaultBalance(smartVault.address)
                  await relayer.withdraw(smartVault.address, balance)

                  const amountInNativeToken = amountIn.div(tokenInNativeRate)
                  await relayer.deposit(smartVault.address, amountInNativeToken)
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

                  context('when the resulting balance is below the max threshold', () => {
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
                      await authorizer
                        .connect(owner)
                        .authorize(owner.address, task.address, setBalanceConnectorsRole, [])
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

                  context('when the resulting balance is above the max threshold', async () => {
                    const diff = thresholdMax.sub(amountIn)
                    const amount = amountIn.add(diff.add(1))

                    it('reverts', async () => {
                      await expect(task.call(tokenIn.address, amount, slippage, data)).to.be.revertedWith(
                        'TaskAmountAboveMaxThreshold'
                      )
                    })
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

              context('when the balance is above the min threshold', () => {
                const diff = thresholdMaxInTokenIn.sub(thresholdMinInTokenIn)
                const amountIn = thresholdMinInTokenIn.add(diff.div(2))

                beforeEach('set smart vault balance in relayer', async function () {
                  const balance = await relayer.getSmartVaultBalance(smartVault.address)
                  await relayer.withdraw(smartVault.address, balance)

                  const amountInNativeToken = amountIn.div(tokenInNativeRate)
                  await relayer.deposit(smartVault.address, amountInNativeToken)
                })

                it('reverts', async () => {
                  await expect(task.call(tokenIn.address, amountIn, 0, '0x')).to.be.revertedWith(
                    'TaskDepositedAboveMinThreshold'
                  )
                })
              })
            })

            context('when the token out is not set', () => {
              const threshold = fp(10000)

              beforeEach('set price feed', async function () {
                const feed = await deployFeedMock(fp(1), 18)
                const setFeedRole = priceOracle.interface.getSighash('setFeed')
                await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
                await priceOracle.connect(owner).setFeed(wrappedNT, tokenIn.address, feed.address)
              })

              beforeEach('set threshold', async () => {
                const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
                await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
                await task.connect(owner).setDefaultTokenThreshold(tokenIn.address, threshold, threshold)
              })

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
          const threshold = fp(10000)

          beforeEach('set price feed', async function () {
            const feed = await deployFeedMock(fp(1), 18)
            const setFeedRole = priceOracle.interface.getSighash('setFeed')
            await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
            await priceOracle.connect(owner).setFeed(wrappedNT, tokenIn.address, feed.address)
          })

          beforeEach('set threshold', async () => {
            const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
            await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
            await task.connect(owner).setDefaultTokenThreshold(tokenIn.address, threshold, threshold)
          })

          it('reverts', async () => {
            await expect(task.call(tokenIn.address, amountIn, 0, '0x')).to.be.revertedWith('TaskAmountZero')
          })
        })
      })

      context('when the token in is the zero address', () => {
        const tokenIn = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.call(tokenIn, 0, 0, '0x')).to.be.reverted
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
