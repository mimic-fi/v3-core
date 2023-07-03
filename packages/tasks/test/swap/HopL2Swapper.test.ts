import { OP } from '@mimic-fi/v3-authorizer'
import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  deployProxy,
  fp,
  getSigners,
  ZERO_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment } from '../../src/setup'
import { itBehavesLikeBaseSwapTask } from './BaseSwapTask.behavior'

describe('HopL2Swapper', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, priceOracle: Contract, connector: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault, priceOracle } = await deployEnvironment(owner))
  })

  before('deploy connector', async () => {
    connector = await deploy('HopSwapConnectorMock')
    const overrideConnectorCheckRole = smartVault.interface.getSighash('overrideConnectorCheck')
    await authorizer.connect(owner).authorize(owner.address, smartVault.address, overrideConnectorCheckRole, [])
    await smartVault.connect(owner).overrideConnectorCheck(connector.address, true)
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'HopL2Swapper',
      [],
      [
        {
          tokenAmms: [],
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

    itBehavesLikeBaseSwapTask()
  })

  describe('setTokenAmm', () => {
    let token: Contract, hToken: Contract, amm: Contract

    before('deploy token and amm mock', async () => {
      token = await deploy('TokenMock', ['TKN'])
      hToken = await deploy('TokenMock', ['hTKN'])
      amm = await deploy('HopL2AmmMock', [token.address, hToken.address])
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setTokenAmmRole = task.interface.getSighash('setTokenAmm')
        await authorizer.connect(owner).authorize(owner.address, task.address, setTokenAmmRole, [])
        task = task.connect(owner)
      })

      context('when the token address is not zero', () => {
        context('when setting the token amm', () => {
          const itSetsTheTokenAmm = () => {
            it('sets the token amm', async () => {
              await task.setTokenAmm(hToken.address, amm.address)

              expect(await task.getTokenAmm(hToken.address)).to.be.equal(amm.address)
            })

            it('emits an event', async () => {
              const tx = await task.setTokenAmm(hToken.address, amm.address)

              await assertEvent(tx, 'TokenAmmSet', { token: hToken, amm: amm })
            })
          }

          context('when the token amm was set', () => {
            beforeEach('set token amm', async () => {
              await task.setTokenAmm(hToken.address, amm.address)
            })

            itSetsTheTokenAmm()
          })

          context('when the token amm was not set', () => {
            beforeEach('unset token amm', async () => {
              await task.setTokenAmm(hToken.address, ZERO_ADDRESS)
            })

            itSetsTheTokenAmm()
          })
        })

        context('when unsetting the token amm', () => {
          const itUnsetsTheTokenAmm = () => {
            it('unsets the token amm', async () => {
              await task.setTokenAmm(hToken.address, ZERO_ADDRESS)

              expect(await task.getTokenAmm(hToken.address)).to.be.equal(ZERO_ADDRESS)
            })

            it('emits an event', async () => {
              const tx = await task.setTokenAmm(hToken.address, ZERO_ADDRESS)

              await assertEvent(tx, 'TokenAmmSet', { token: hToken, amm: ZERO_ADDRESS })
            })
          }

          context('when the token amm was set', () => {
            beforeEach('set token amm', async () => {
              await task.setTokenAmm(hToken.address, amm.address)
            })

            itUnsetsTheTokenAmm()
          })

          context('when the token was not set', () => {
            beforeEach('unset token amm', async () => {
              await task.setTokenAmm(hToken.address, ZERO_ADDRESS)
            })

            itUnsetsTheTokenAmm()
          })
        })
      })

      context('when the token address is zero', () => {
        const hToken = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.setTokenAmm(hToken, amm.address)).to.be.revertedWith('TASK_HOP_TOKEN_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setTokenAmm(hToken.address, amm.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
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
          tokenIn = await deploy('TokenMock', ['IN'])
        })

        context('when the amount in is not zero', () => {
          const amountIn = fp(10)

          context('when the token in is allowed', () => {
            context('when there is a token out set', () => {
              let tokenOut: Contract

              beforeEach('set default token out', async () => {
                tokenOut = await deploy('TokenMock', ['OUT'])
                const setDefaultTokenOutRole = task.interface.getSighash('setDefaultTokenOut')
                await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenOutRole, [])
                await task.connect(owner).setDefaultTokenOut(tokenOut.address)
              })

              beforeEach('set price feed', async () => {
                const feed = await deploy('FeedMock', [fp(1), 18])
                const setFeedRole = priceOracle.interface.getSighash('setFeed')
                await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
                await priceOracle.connect(owner).setFeed(tokenIn.address, tokenOut.address, feed.address)
              })

              beforeEach('set threshold', async () => {
                const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
                await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
                await task.connect(owner).setDefaultTokenThreshold({
                  token: tokenOut.address,
                  min: amountIn,
                  max: 0,
                })
              })

              context('when the given token has an AMM set', () => {
                let amm: Contract

                beforeEach('set token AMM', async () => {
                  amm = await deploy('HopL2AmmMock', [tokenOut.address, tokenIn.address])
                  const setTokenAmmRole = task.interface.getSighash('setTokenAmm')
                  await authorizer.connect(owner).authorize(owner.address, task.address, setTokenAmmRole, [])
                  await task.connect(owner).setTokenAmm(tokenIn.address, amm.address)
                })

                context('when the smart vault balance passes the threshold', () => {
                  beforeEach('fund smart vault', async () => {
                    await tokenIn.mint(smartVault.address, amountIn)
                  })

                  context('when the slippage is below the limit', () => {
                    const slippage = fp(0.01)
                    const expectedAmountOut = amountIn
                    const minAmountOut = expectedAmountOut.mul(fp(1).sub(slippage)).div(fp(1))

                    beforeEach('set max slippage', async () => {
                      const setDefaultMaxSlippageRole = task.interface.getSighash('setDefaultMaxSlippage')
                      await authorizer
                        .connect(owner)
                        .authorize(owner.address, task.address, setDefaultMaxSlippageRole, [])
                      await task.connect(owner).setDefaultMaxSlippage(slippage)
                    })

                    it('executes the expected connector', async () => {
                      const tx = await task.call(tokenIn.address, amountIn, slippage)

                      const connectorData = connector.interface.encodeFunctionData('execute', [
                        tokenIn.address,
                        tokenOut.address,
                        amountIn,
                        minAmountOut,
                        amm.address,
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
                        hopDexAddress: amm.address,
                      })
                    })

                    it('emits an Executed event', async () => {
                      const tx = await task.call(tokenIn.address, amountIn, slippage)

                      await assertEvent(tx, 'Executed')
                    })
                  })

                  context('when the slippage is above the limit', () => {
                    const slippage = fp(0.01)

                    it('reverts', async () => {
                      await expect(task.call(tokenIn.address, amountIn, slippage)).to.be.revertedWith(
                        'TASK_SLIPPAGE_TOO_HIGH'
                      )
                    })
                  })
                })

                context('when the smart vault balance does not pass the threshold', () => {
                  const amountIn = fp(1)

                  beforeEach('fund smart vault', async () => {
                    await tokenIn.mint(smartVault.address, amountIn)
                  })

                  it('reverts', async () => {
                    await expect(task.call(tokenIn.address, amountIn, 0)).to.be.revertedWith(
                      'TASK_TOKEN_THRESHOLD_NOT_MET'
                    )
                  })
                })
              })

              context('when the given token does not have an AMM set', () => {
                it('reverts', async () => {
                  await expect(task.call(tokenIn.address, amountIn, 0)).to.be.revertedWith('TASK_MISSING_HOP_TOKEN_AMM')
                })
              })
            })

            context('when the token out is not set', () => {
              it('reverts', async () => {
                await expect(task.call(tokenIn.address, amountIn, 0)).to.be.revertedWith('TASK_TOKEN_OUT_NOT_SET')
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
              await expect(task.call(tokenIn.address, 0, 0)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')
            })
          })
        })

        context('when the amount in is zero', () => {
          const amountIn = 0

          it('reverts', async () => {
            await expect(task.call(tokenIn.address, amountIn, 0)).to.be.revertedWith('TASK_AMOUNT_ZERO')
          })
        })
      })

      context('when the token in is the zero address', () => {
        const tokenIn = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.call(tokenIn, 0, 0)).to.be.revertedWith('TASK_TOKEN_ZERO')
        })
      })
    })

    context('when the sender is authorized', () => {
      it('reverts', async () => {
        await expect(task.call(ZERO_ADDRESS, 0, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
