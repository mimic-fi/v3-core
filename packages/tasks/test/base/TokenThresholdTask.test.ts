import { assertEvent, BigNumberish, deploy, deployProxy, fp, getSigners, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { deployEnvironment } from '../../src/setup'

/* eslint-disable no-secrets/no-secrets */

describe('TokenThresholdTask', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, priceOracle: Contract, owner: SignerWithAddress

  const tokenA = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  const tokenB = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, priceOracle, smartVault } = await deployEnvironment(owner))
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'TokenThresholdTaskMock',
      [],
      [
        {
          baseConfig: {
            owner: owner.address,
            smartVault: smartVault.address,
            tokensSource: smartVault.address,
          },
          tokenThresholdConfig: {
            customThresholds: [],
            defaultThreshold: {
              token: ZERO_ADDRESS,
              min: 0,
              max: 0,
            },
          },
        },
      ]
    )
  })

  describe('setDefaultTokenThreshold', () => {
    const token = tokenA

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
        await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
        task = task.connect(owner)
      })

      const itCanBeSet = (token: string, min: BigNumberish, max: BigNumberish) => {
        it('sets the default correctly', async () => {
          await task.setDefaultTokenThreshold({ token, min, max })

          const threshold = await task.defaultTokenThreshold()
          expect(threshold.token).to.be.equal(token)
          expect(threshold.min).to.be.equal(min)
          expect(threshold.max).to.be.equal(max)
        })

        it('emits an event', async () => {
          const tx = await task.setDefaultTokenThreshold({ token, min, max })
          assertEvent(tx, 'DefaultThresholdSet', { threshold: { token, min, max } })
        })
      }

      context('when the maximum amount is zero', () => {
        const max = fp(0)

        context('when the minimum amount is zero', () => {
          const min = fp(0)

          itCanBeSet(token, min, max)
        })

        context('when the minimum amount is not zero', () => {
          const min = fp(2)

          itCanBeSet(token, min, max)
        })
      })

      context('when the maximum amount is not zero', () => {
        const max = fp(2)

        context('when the minimum amount is zero', () => {
          const min = 0

          itCanBeSet(token, min, max)
        })

        context('when the minimum amount is not zero', () => {
          context('when the minimum amount is lower than the maximum amount', () => {
            const min = max.sub(1)

            itCanBeSet(token, min, max)
          })

          context('when the minimum amount is equal to the maximum amount', () => {
            const min = max

            itCanBeSet(token, min, max)
          })

          context('when the minimum amount is greater than the maximum amount', () => {
            const min = max.add(1)

            it('reverts', async () => {
              await expect(task.setDefaultTokenThreshold({ token, min, max })).to.be.revertedWith(
                'TASK_BAD_THRESHOLD_MAX_LT_MIN'
              )
            })
          })
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setDefaultTokenThreshold({ token, min: 0, max: 0 })).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })

  describe('setCustomTokenThreshold', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setCustomTokenThresholdRole = task.interface.getSighash('setCustomTokenThreshold')
        await authorizer.connect(owner).authorize(owner.address, task.address, setCustomTokenThresholdRole, [])
        task = task.connect(owner)
      })

      const itCanBeSet = (token: string, thresholdToken: string, min: BigNumberish, max: BigNumberish) => {
        it('sets the custom token threshold correctly', async () => {
          await task.setCustomTokenThreshold(token, { token: thresholdToken, min, max })

          const threshold = await task.customTokenThreshold(token)
          expect(threshold.token).to.be.equal(thresholdToken)
          expect(threshold.min).to.be.equal(min)
          expect(threshold.max).to.be.equal(max)
        })

        it('emits an event', async () => {
          const tx = await task.setCustomTokenThreshold(token, { token: thresholdToken, min, max })

          assertEvent(tx, 'TokenThresholdSet', { token, threshold: { token: thresholdToken, min, max } })
        })
      }

      context('when the token is not zero', () => {
        const token = tokenA
        const thresholdToken = tokenB

        context('when the maximum amount is zero', () => {
          const max = fp(0)

          context('when the minimum amount is zero', () => {
            const min = fp(0)

            itCanBeSet(token, thresholdToken, min, max)
          })

          context('when the minimum amount is not zero', () => {
            const min = fp(2)

            itCanBeSet(token, thresholdToken, min, max)
          })
        })

        context('when the maximum amount is not zero', () => {
          const max = fp(2)

          context('when the minimum amount is zero', () => {
            const min = 0

            itCanBeSet(token, thresholdToken, min, max)
          })

          context('when the minimum amount is not zero', () => {
            context('when the minimum amount is lower than the maximum amount', () => {
              const min = max.sub(1)

              itCanBeSet(token, thresholdToken, min, max)
            })

            context('when the minimum amount is equal to the maximum amount', () => {
              const min = max

              itCanBeSet(token, thresholdToken, min, max)
            })

            context('when the minimum amount is greater than the maximum amount', () => {
              const min = max.add(1)

              it('reverts', async () => {
                await expect(
                  task.setCustomTokenThreshold(token, { token: thresholdToken, min, max })
                ).to.be.revertedWith('TASK_BAD_THRESHOLD_MAX_LT_MIN')
              })
            })
          })
        })
      })

      context('when the token is zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.setCustomTokenThreshold(token, { token: ZERO_ADDRESS, min: 0, max: 0 })).to.be.revertedWith(
            'TASK_THRESHOLD_TOKEN_ZERO'
          )
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(
          task.setCustomTokenThreshold(ZERO_ADDRESS, { token: ZERO_ADDRESS, min: 0, max: 0 })
        ).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    let USDC: string, USDT: string, WETH: string

    before('deploy tokens', async () => {
      USDC = (await deploy('TokenMock', ['USDC'])).address
      USDT = (await deploy('TokenMock', ['USDT'])).address
      WETH = (await deploy('TokenMock', ['WETH'])).address
    })

    const assertValid = async (token: string, amount: BigNumberish) => {
      await expect(task.call(token, amount)).not.to.be.reverted
    }

    const assertInvalid = async (token: Contract | string, amount: BigNumberish) => {
      await expect(task.call(token, amount)).to.be.revertedWith('TASK_TOKEN_THRESHOLD_NOT_MET')
    }

    context('when there is no default threshold set', () => {
      context('when there are no custom thresholds set', () => {
        it('allows any combination', async () => {
          await assertValid(WETH, fp(0))
          await assertValid(WETH, fp(1000))

          await assertValid(USDC, fp(0))
          await assertValid(USDC, fp(1000))

          await assertValid(ZERO_ADDRESS, fp(0))
          await assertValid(ZERO_ADDRESS, fp(1000))
        })
      })

      context('when there is a custom threshold set', () => {
        beforeEach('mock price feed', async () => {
          const feed = await deploy('FeedMock', [fp(1600), 18])
          const setFeedRole = await priceOracle.interface.getSighash('setFeed')
          await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
          await priceOracle.connect(owner).setFeed(WETH, USDT, feed.address)
        })

        beforeEach('set threshold', async () => {
          const setCustomTokenThresholdRole = task.interface.getSighash('setCustomTokenThreshold')
          await authorizer.connect(owner).authorize(owner.address, task.address, setCustomTokenThresholdRole, [])
          await task.connect(owner).setCustomTokenThreshold(WETH, { token: USDT, min: fp(3200), max: fp(6400) })
        })

        it('applies only for when the requested token matches', async () => {
          // Applies the default threshold for WETH
          await assertInvalid(WETH, fp(0))
          await assertInvalid(WETH, fp(1))
          await assertValid(WETH, fp(2))
          await assertValid(WETH, fp(3))
          await assertValid(WETH, fp(4))
          await assertInvalid(WETH, fp(5))
          await assertInvalid(WETH, fp(100))

          // No threshold set
          await assertValid(USDC, fp(0))
          await assertValid(USDC, fp(1000))

          // No threshold set
          await assertValid(ZERO_ADDRESS, fp(0))
          await assertValid(ZERO_ADDRESS, fp(1000))
        })
      })
    })

    context('when there is a default threshold set', () => {
      beforeEach('mock price feed', async () => {
        const feed = await deploy('FeedMock', [fp(1600), 18])
        const setFeedRole = await priceOracle.interface.getSighash('setFeed')
        await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
        await priceOracle.connect(owner).setFeed(WETH, USDC, feed.address)
      })

      beforeEach('set default', async () => {
        const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
        await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
        await task.connect(owner).setDefaultTokenThreshold({ token: USDC, min: fp(400), max: fp(800) })
      })

      context('when there are no custom thresholds set', () => {
        it('applies the default threshold', async () => {
          // Applies the default threshold for WETH
          await assertInvalid(WETH, fp(0))
          await assertValid(WETH, fp(0.25))
          await assertValid(WETH, fp(0.5))
          await assertInvalid(WETH, fp(1))

          // Applies the default threshold for USDC
          await assertInvalid(USDC, fp(0))
          await assertInvalid(USDC, fp(300))
          await assertValid(USDC, fp(400))
          await assertValid(USDC, fp(600))
          await assertValid(USDC, fp(800))
          await assertInvalid(USDC, fp(1000))

          // It tries to fetch a rate since it tries to use the default threshold
          await expect(task.call(USDT, fp(0))).to.be.reverted
          await expect(task.call(ZERO_ADDRESS, fp(0))).to.be.reverted
        })
      })

      context('when there is a custom threshold set', () => {
        beforeEach('mock price feed', async () => {
          const feed = await deploy('FeedMock', [fp(1650), 18])
          const setFeedRole = await priceOracle.interface.getSighash('setFeed')
          await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
          await priceOracle.connect(owner).setFeed(WETH, USDT, feed.address)
        })

        beforeEach('set threshold', async () => {
          const setCustomTokenThresholdRole = task.interface.getSighash('setCustomTokenThreshold')
          await authorizer.connect(owner).authorize(owner.address, task.address, setCustomTokenThresholdRole, [])
          await task.connect(owner).setCustomTokenThreshold(WETH, { token: USDT, min: fp(3300), max: fp(6600) })
        })

        it('applies the custom threshold only when the requested token matches', async () => {
          // Applies the custom threshold for WETH
          await assertInvalid(WETH, fp(0))
          await assertInvalid(WETH, fp(1))
          await assertValid(WETH, fp(2))
          await assertValid(WETH, fp(3))
          await assertValid(WETH, fp(4))
          await assertInvalid(WETH, fp(5))
          await assertInvalid(WETH, fp(100))

          // Applies the default threshold for USDC
          await assertInvalid(USDC, fp(0))
          await assertInvalid(USDC, fp(300))
          await assertValid(USDC, fp(400))
          await assertValid(USDC, fp(600))
          await assertValid(USDC, fp(800))
          await assertInvalid(USDC, fp(1000))

          // It tries to fetch a rate since it tries to use the default threshold
          await expect(task.call(USDT, fp(0))).to.be.reverted
          await expect(task.call(ZERO_ADDRESS, fp(0))).to.be.reverted
        })
      })
    })
  })
})
