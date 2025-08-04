import {
  assertEvent,
  assertIndirectEvent,
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

import { buildEmptyTaskConfig, deployEnvironment, Mimic } from '../../src/setup'
import { itBehavesLikeBaseRelayerFundTask } from './BaseRelayerFundTask.behavior'

/* eslint-disable no-secrets/no-secrets */

describe('ParaswapV6RelayerFunder', () => {
  let task: Contract, relayer: Contract
  let smartVault: Contract, authorizer: Contract, priceOracle: Contract, connector: Contract, mimic: Mimic
  let owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault, priceOracle, mimic } = await deployEnvironment(owner))
  })

  before('deploy connector', async () => {
    connector = await deploy('ParaswapV6ConnectorMock')
    const overrideConnectorCheckRole = smartVault.interface.getSighash('overrideConnectorCheck')
    await authorizer.connect(owner).authorize(owner.address, smartVault.address, overrideConnectorCheckRole, [])
    await smartVault.connect(owner).overrideConnectorCheck(connector.address, true)
  })

  beforeEach('deploy task', async () => {
    relayer = await deploy('RelayerMock', [])
    task = await deployProxy(
      'ParaswapV6RelayerFunder',
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
      'initializeParaswapV6RelayerFunder'
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

    itBehavesLikeBaseRelayerFundTask('PARASWAP_V6_SWAPPER')
  })

  describe('paraswap v6 swapper', () => {
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

      context('when the given token in is not zero', () => {
        let tokenIn: Contract
        const rateTokenInNative = 4 // 1 native = 4 token in

        beforeEach('deploy token in', async () => {
          tokenIn = await deployTokenMock('in')
        })

        beforeEach('set price feed', async function () {
          const feed = await deploy('FeedMock', [fp(1).div(rateTokenInNative), 18])
          const setFeedRole = priceOracle.interface.getSighash('setFeed')
          await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
          await priceOracle.connect(owner).setFeed(tokenIn.address, mimic.wrappedNativeToken.address, feed.address)
        })

        context('when there is a threshold set for the given token', () => {
          let thresholdToken: Contract
          const thresholdMin = fp(1)
          const thresholdMax = thresholdMin.mul(10)

          beforeEach('set default token threshold', async () => {
            thresholdToken = await deployTokenMock('threshold')
            const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
            await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
            await task.connect(owner).setDefaultTokenThreshold(thresholdToken.address, thresholdMin, thresholdMax)
          })

          context('when there is a token out set', () => {
            let tokenOut: Contract // equal threshold token
            const rateTokenInTokenOut = 2 // 1 token out = 2 token in
            const rateTokenOutNative = rateTokenInNative / rateTokenInTokenOut
            const rateThresholdTokenNative = rateTokenOutNative

            beforeEach('set default token out', async () => {
              tokenOut = thresholdToken
              const setDefaultTokenOutRole = task.interface.getSighash('setDefaultTokenOut')
              await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenOutRole, [])
              await task.connect(owner).setDefaultTokenOut(tokenOut.address)
            })

            beforeEach('set price feed', async function () {
              const feed = await deploy('FeedMock', [fp(1).div(rateTokenOutNative), 18])
              const setFeedRole = priceOracle.interface.getSighash('setFeed')
              await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
              await priceOracle.connect(owner).setFeed(tokenOut.address, mimic.wrappedNativeToken.address, feed.address)
            })

            context('when the used quota is zero', () => {
              context('when the balance is below the min threshold', () => {
                const deposited = thresholdMin.div(rateThresholdTokenNative).div(2)

                beforeEach('set smart vault balance in relayer', async () => {
                  await relayer.deposit(smartVault.address, deposited)
                })

                context('when the resulting balance is below the max threshold', () => {
                  const amountIn = thresholdMax.sub(deposited.mul(rateThresholdTokenNative)).mul(rateTokenInTokenOut)

                  beforeEach('fund smart vault', async () => {
                    await tokenIn.mint(smartVault.address, amountIn)
                  })

                  context('when the slippage is below the limit', () => {
                    const data = '0xaabb'
                    const slippage = fp(0.01)
                    const expectedAmountOut = amountIn.div(rateTokenInTokenOut)
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

                context('when the resulting balance is above the max threshold', () => {
                  const amountIn = thresholdMax
                    .sub(deposited.mul(rateThresholdTokenNative))
                    .mul(rateTokenInTokenOut)
                    .add(1)

                  it('reverts', async () => {
                    await expect(task.call(tokenIn.address, amountIn, 0, '0x')).to.be.revertedWith(
                      'TaskNewDepositAboveMaxThreshold'
                    )
                  })
                })
              })

              context('when the resulting balance is above the min threshold', () => {
                const deposited = thresholdMin.div(rateThresholdTokenNative)

                beforeEach('set smart vault balance in relayer', async () => {
                  await relayer.deposit(smartVault.address, deposited)
                })

                it('reverts', async () => {
                  await expect(task.call(tokenIn.address, 0, 0, '0x')).to.be.revertedWith(
                    'TaskDepositAboveMinThreshold'
                  )
                })
              })
            })

            context('when the used quota is not zero', () => {
              const usedQuota = fp(1)

              beforeEach('set used quota', async () => {
                await relayer.setSmartVaultUsedQuota(smartVault.address, usedQuota)
              })

              context('when the amount in covers the used quota', () => {
                context('when the resulting balance is below the max threshold', () => {
                  const amountIn = thresholdMax.add(usedQuota.mul(rateThresholdTokenNative))

                  beforeEach('fund tokens source', async () => {
                    await tokenIn.mint(smartVault.address, amountIn)
                  })

                  context('when the slippage is below the limit', () => {
                    const data = '0xaabb'
                    const slippage = fp(0.01)
                    const expectedAmountOut = amountIn.div(rateTokenInTokenOut)
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

                context('when the resulting balance is above the max threshold', () => {
                  const amountIn = thresholdMax
                    .add(usedQuota.mul(rateThresholdTokenNative))
                    .mul(rateTokenInTokenOut)
                    .add(1)

                  it('reverts', async () => {
                    await expect(task.call(tokenIn.address, amountIn, 0, '0x')).to.be.revertedWith(
                      'TaskNewDepositAboveMaxThreshold'
                    )
                  })
                })
              })

              context('when the amount in does not cover the used quota', () => {
                const amountIn = usedQuota.mul(rateThresholdTokenNative).sub(1)

                it('reverts', async () => {
                  await expect(task.call(tokenIn.address, amountIn, 0, '0x')).to.be.revertedWith(
                    'TaskDepositBelowUsedQuota'
                  )
                })
              })
            })
          })

          context('when there is no token out set', () => {
            beforeEach('set price feed', async function () {
              const feed = await deploy('FeedMock', [fp(1), 18])
              const setFeedRole = priceOracle.interface.getSighash('setFeed')
              await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
              await priceOracle
                .connect(owner)
                .setFeed(thresholdToken.address, mimic.wrappedNativeToken.address, feed.address)
            })

            it('reverts', async () => {
              await expect(task.call(tokenIn.address, 0, 0, '0x')).to.be.revertedWith('TaskTokenOutNotSet')
            })
          })
        })

        context('when there is no threshold set for the given token', () => {
          it('reverts', async () => {
            await expect(task.call(tokenIn.address, 0, 0, '0x')).to.be.revertedWith('TaskTokenThresholdNotSet')
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
