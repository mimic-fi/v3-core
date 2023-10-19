import {
  advanceTime,
  assertEvent,
  BigNumberish,
  currentTimestamp,
  deployFeedMock,
  deployProxy,
  deployTokenMock,
  fp,
  getSigners,
  MONTH,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { deployEnvironment } from '../../src/setup'

/* eslint-disable no-secrets/no-secrets */

describe('VolumeLimitedTask', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, priceOracle: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, priceOracle, smartVault } = await deployEnvironment(owner))
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'VolumeLimitedTaskMock',
      [],
      [
        {
          baseConfig: {
            smartVault: smartVault.address,
            previousBalanceConnectorId: ZERO_BYTES32,
            nextBalanceConnectorId: ZERO_BYTES32,
          },
          volumeLimitConfig: {
            customVolumeLimitConfigs: [],
            defaultVolumeLimit: {
              token: ZERO_ADDRESS,
              amount: 0,
              period: 0,
            },
          },
        },
      ]
    )
  })

  describe('setDefaultVolumeLimit', () => {
    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setDefaultVolumeLimitRole = task.interface.getSighash('setDefaultVolumeLimit')
        await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultVolumeLimitRole, [])
        task = task.connect(owner)
      })

      context('when there was no volume limit set', () => {
        const itSetsTheVolumeLimitCorrectly = (token: string, amount: BigNumberish, period: BigNumberish) => {
          it('sets the volume limit', async () => {
            await task.setDefaultVolumeLimit(token, amount, period)

            const volumeLimit = await task.defaultVolumeLimit()
            expect(volumeLimit.limitToken).to.be.equal(token)
            expect(volumeLimit.amount).to.be.equal(amount)
            expect(volumeLimit.period).to.be.equal(period)
            expect(volumeLimit.accrued).to.be.equal(0)
            expect(volumeLimit.nextResetTime).to.be.equal(amount != 0 ? (await currentTimestamp()).add(period) : 0)
          })

          it('emits an event', async () => {
            const tx = await task.setDefaultVolumeLimit(token, amount, period)
            await assertEvent(tx, 'DefaultVolumeLimitSet', { limitToken: token, amount, period })
          })

          it('does not affect the custom limit', async () => {
            const previousCustomLimit = await task.customVolumeLimit(token)

            await task.setDefaultVolumeLimit(token, amount, period)

            const currentCustomLimit = await task.customVolumeLimit(token)
            expect(currentCustomLimit.limitToken).to.be.equal(previousCustomLimit.limitToken)
            expect(currentCustomLimit.amount).to.be.equal(previousCustomLimit.amount)
            expect(currentCustomLimit.period).to.be.equal(previousCustomLimit.period)
            expect(currentCustomLimit.accrued).to.be.equal(previousCustomLimit.accrued)
            expect(currentCustomLimit.nextResetTime).to.be.equal(previousCustomLimit.nextResetTime)
          })
        }

        context('when the amount is not zero', async () => {
          const amount = fp(100)

          context('when the token is not zero', async () => {
            const token = NATIVE_TOKEN_ADDRESS

            context('when the period is not zero', async () => {
              const period = MONTH

              itSetsTheVolumeLimitCorrectly(token, amount, period)
            })

            context('when the period is zero', async () => {
              const period = 0

              it('reverts', async () => {
                await expect(task.setDefaultVolumeLimit(token, amount, period)).to.be.revertedWith(
                  'TaskInvalidVolumeLimitInput'
                )
              })
            })
          })

          context('when the token is zero', async () => {
            const token = ZERO_ADDRESS

            context('when the period is not zero', async () => {
              const period = MONTH

              it('reverts', async () => {
                await expect(task.setDefaultVolumeLimit(token, amount, period)).to.be.revertedWith(
                  'TaskInvalidVolumeLimitInput'
                )
              })
            })

            context('when the period is zero', async () => {
              const period = 0

              it('reverts', async () => {
                await expect(task.setDefaultVolumeLimit(token, amount, period)).to.be.revertedWith(
                  'TaskInvalidVolumeLimitInput'
                )
              })
            })
          })
        })

        context('when the amount is zero', async () => {
          const amount = 0

          context('when the token is not zero', async () => {
            const token = NATIVE_TOKEN_ADDRESS

            context('when the period is not zero', async () => {
              const period = MONTH

              it('reverts', async () => {
                await expect(task.setDefaultVolumeLimit(token, amount, period)).to.be.revertedWith(
                  'TaskInvalidVolumeLimitInput'
                )
              })
            })

            context('when the period is zero', async () => {
              const period = 0

              it('reverts', async () => {
                await expect(task.setDefaultVolumeLimit(token, amount, period)).to.be.revertedWith(
                  'TaskInvalidVolumeLimitInput'
                )
              })
            })
          })

          context('when the token is zero', async () => {
            const token = ZERO_ADDRESS

            context('when the period is not zero', async () => {
              const period = MONTH

              it('reverts', async () => {
                await expect(task.setDefaultVolumeLimit(token, amount, period)).to.be.revertedWith(
                  'TaskInvalidVolumeLimitInput'
                )
              })
            })

            context('when the period is zero', async () => {
              const period = 0

              itSetsTheVolumeLimitCorrectly(token, amount, period)
            })
          })
        })
      })

      context('when there was a volume limit already set', () => {
        let token: Contract
        const amount = fp(200)
        const period = MONTH * 2

        beforeEach('set volume limit', async () => {
          token = await deployTokenMock('TKN')
          await task.setDefaultVolumeLimit(token.address, amount, period)
        })

        context('when there was no accrued value', () => {
          const rate = 2
          const newAmount = amount.mul(rate)
          const newPeriod = period * rate
          let newToken: Contract

          beforeEach('deploy new token', async () => {
            newToken = await deployTokenMock('TKN')
            const feed = await deployFeedMock(fp(rate), 18)
            const setFeedRole = priceOracle.interface.getSighash('setFeed')
            await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
            await priceOracle.connect(owner).setFeed(token.address, newToken.address, feed.address)
          })

          it('sets the volume limit without updating the next reset time', async () => {
            const { nextResetTime: previousResetTime } = await task.defaultVolumeLimit()

            await task.setDefaultVolumeLimit(newToken.address, newAmount, newPeriod)

            const volumeLimit = await task.defaultVolumeLimit()
            expect(volumeLimit.limitToken).to.be.equal(newToken.address)
            expect(volumeLimit.amount).to.be.equal(newAmount)
            expect(volumeLimit.period).to.be.equal(newPeriod)
            expect(volumeLimit.accrued).to.be.equal(0)
            expect(volumeLimit.nextResetTime).to.be.equal(previousResetTime)
          })

          it('emits an event', async () => {
            const tx = await task.setDefaultVolumeLimit(newToken.address, newAmount, newPeriod)
            await assertEvent(tx, 'DefaultVolumeLimitSet', {
              limitToken: newToken,
              amount: newAmount,
              period: newPeriod,
            })
          })
        })

        context('when there was some volume accrued', () => {
          beforeEach('accrue volume', async () => {
            await task.connect(owner).call(token.address, fp(1))
          })

          context('when the volume limit amount is being changed', () => {
            const rate = 2
            const newAmount = amount.mul(rate).mul(3)
            const newPeriod = period * rate
            let newToken: Contract

            beforeEach('deploy new token', async () => {
              newToken = await deployTokenMock('TKN')
              const feed = await deployFeedMock(fp(rate), 18)
              const setFeedRole = priceOracle.interface.getSighash('setFeed')
              await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
              await priceOracle.connect(owner).setFeed(token.address, newToken.address, feed.address)
            })

            it('sets the volume limit without updating the next reset time', async () => {
              const previousVolumeLimit = await task.defaultVolumeLimit()

              await task.setDefaultVolumeLimit(newToken.address, newAmount, newPeriod)

              const volumeLimit = await task.defaultVolumeLimit()
              expect(volumeLimit.limitToken).to.be.equal(newToken.address)
              expect(volumeLimit.amount).to.be.equal(newAmount)
              expect(volumeLimit.period).to.be.equal(newPeriod)
              expect(volumeLimit.accrued).to.be.equal(previousVolumeLimit.accrued.mul(rate))
              expect(volumeLimit.nextResetTime).to.be.equal(previousVolumeLimit.nextResetTime)
            })

            it('emits an event', async () => {
              const tx = await task.setDefaultVolumeLimit(newToken.address, newAmount, newPeriod)
              await assertEvent(tx, 'DefaultVolumeLimitSet', {
                limitToken: newToken,
                amount: newAmount,
                period: newPeriod,
              })
            })
          })

          context('when the volume limit amount is being removed', () => {
            const newToken = ZERO_ADDRESS
            const newAmount = 0
            const newPeriod = 0

            it('sets the volume limit and resets the totalizators', async () => {
              await task.setDefaultVolumeLimit(newToken, newAmount, newPeriod)

              const volumeLimit = await task.defaultVolumeLimit()
              expect(volumeLimit.limitToken).to.be.equal(newToken)
              expect(volumeLimit.amount).to.be.equal(newAmount)
              expect(volumeLimit.period).to.be.equal(newPeriod)
              expect(volumeLimit.accrued).to.be.equal(0)
              expect(volumeLimit.nextResetTime).to.be.equal(0)
            })

            it('emits an event', async () => {
              const tx = await task.setDefaultVolumeLimit(newToken, newAmount, newPeriod)
              await assertEvent(tx, 'DefaultVolumeLimitSet', {
                limitToken: newToken,
                amount: newAmount,
                period: newPeriod,
              })
            })
          })
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setDefaultVolumeLimit(ZERO_ADDRESS, 0, 0)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('setCustomVolumeLimit', () => {
    let token: Contract

    beforeEach('deploy new token', async () => {
      token = await deployTokenMock('TKN')
    })

    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setCustomVolumeLimitRole = task.interface.getSighash('setCustomVolumeLimit')
        await authorizer.connect(owner).authorize(owner.address, task.address, setCustomVolumeLimitRole, [])
        task = task.connect(owner)
      })

      context('when there was no volume limit set', () => {
        const itSetsTheVolumeLimitCorrectly = (limitToken: string, amount: BigNumberish, period: BigNumberish) => {
          it('sets the volume limit', async () => {
            await task.setCustomVolumeLimit(token.address, limitToken, amount, period)

            const volumeLimit = await task.customVolumeLimit(token.address)
            expect(volumeLimit.limitToken).to.be.equal(limitToken)
            expect(volumeLimit.amount).to.be.equal(amount)
            expect(volumeLimit.period).to.be.equal(period)
            expect(volumeLimit.accrued).to.be.equal(0)
            expect(volumeLimit.nextResetTime).to.be.equal(amount != 0 ? (await currentTimestamp()).add(period) : 0)
          })

          it('emits an event', async () => {
            const tx = await task.setCustomVolumeLimit(token.address, limitToken, amount, period)
            await assertEvent(tx, 'CustomVolumeLimitSet', { token, limitToken, amount, period })
          })

          it('does not affect the default limit', async () => {
            const previousDefaultLimit = await task.defaultVolumeLimit()

            await task.setCustomVolumeLimit(token.address, limitToken, amount, period)

            const currentDefaultLimit = await task.defaultVolumeLimit()
            expect(currentDefaultLimit.token).to.be.equal(previousDefaultLimit.token)
            expect(currentDefaultLimit.amount).to.be.equal(previousDefaultLimit.amount)
            expect(currentDefaultLimit.period).to.be.equal(previousDefaultLimit.period)
            expect(currentDefaultLimit.accrued).to.be.equal(previousDefaultLimit.accrued)
            expect(currentDefaultLimit.nextResetTime).to.be.equal(previousDefaultLimit.nextResetTime)
          })
        }

        context('when the amount is not zero', async () => {
          const amount = fp(100)

          context('when the token is not zero', async () => {
            const limitToken = NATIVE_TOKEN_ADDRESS

            context('when the period is not zero', async () => {
              const period = MONTH

              itSetsTheVolumeLimitCorrectly(limitToken, amount, period)
            })

            context('when the period is zero', async () => {
              const period = 0

              it('reverts', async () => {
                await expect(task.setCustomVolumeLimit(token.address, limitToken, amount, period)).to.be.revertedWith(
                  'TaskInvalidVolumeLimitInput'
                )
              })
            })
          })

          context('when the token is zero', async () => {
            const limitToken = ZERO_ADDRESS

            context('when the period is not zero', async () => {
              const period = MONTH

              it('reverts', async () => {
                await expect(task.setCustomVolumeLimit(token.address, limitToken, amount, period)).to.be.revertedWith(
                  'TaskInvalidVolumeLimitInput'
                )
              })
            })

            context('when the period is zero', async () => {
              const period = 0

              it('reverts', async () => {
                await expect(task.setCustomVolumeLimit(token.address, limitToken, amount, period)).to.be.revertedWith(
                  'TaskInvalidVolumeLimitInput'
                )
              })
            })
          })
        })

        context('when the amount is zero', async () => {
          const amount = 0

          context('when the token is not zero', async () => {
            const limitToken = NATIVE_TOKEN_ADDRESS

            context('when the period is not zero', async () => {
              const period = MONTH

              it('reverts', async () => {
                await expect(task.setCustomVolumeLimit(token.address, limitToken, amount, period)).to.be.revertedWith(
                  'TaskInvalidVolumeLimitInput'
                )
              })
            })

            context('when the period is zero', async () => {
              const period = 0

              it('reverts', async () => {
                await expect(task.setCustomVolumeLimit(token.address, limitToken, amount, period)).to.be.revertedWith(
                  'TaskInvalidVolumeLimitInput'
                )
              })
            })
          })

          context('when the token is zero', async () => {
            const limitToken = ZERO_ADDRESS

            context('when the period is not zero', async () => {
              const period = MONTH

              it('reverts', async () => {
                await expect(task.setCustomVolumeLimit(token.address, limitToken, amount, period)).to.be.revertedWith(
                  'TaskInvalidVolumeLimitInput'
                )
              })
            })

            context('when the period is zero', async () => {
              const period = 0

              itSetsTheVolumeLimitCorrectly(limitToken, amount, period)
            })
          })
        })
      })

      context('when there was a volume limit already set', () => {
        let limitToken: Contract
        const amount = fp(200)
        const period = MONTH * 2

        beforeEach('set volume limit', async () => {
          limitToken = await deployTokenMock('TKN')
          await task.setCustomVolumeLimit(token.address, limitToken.address, amount, period)
        })

        context('when there was no accrued value', () => {
          const rate = 2
          const newAmount = amount.mul(rate)
          const newPeriod = period * rate
          let newLimitToken: Contract

          beforeEach('deploy new token', async () => {
            newLimitToken = await deployTokenMock('TKN')
            const feed = await deployFeedMock(fp(rate), 18)
            const setFeedRole = priceOracle.interface.getSighash('setFeed')
            await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
            await priceOracle.connect(owner).setFeed(limitToken.address, newLimitToken.address, feed.address)
          })

          it('sets the volume limit without updating the next reset time', async () => {
            const { nextResetTime: previousResetTime } = await task.customVolumeLimit(token.address)

            await task.setCustomVolumeLimit(token.address, newLimitToken.address, newAmount, newPeriod)

            const volumeLimit = await task.customVolumeLimit(token.address)
            expect(volumeLimit.limitToken).to.be.equal(newLimitToken.address)
            expect(volumeLimit.amount).to.be.equal(newAmount)
            expect(volumeLimit.period).to.be.equal(newPeriod)
            expect(volumeLimit.accrued).to.be.equal(0)
            expect(volumeLimit.nextResetTime).to.be.equal(previousResetTime)
          })

          it('emits an event', async () => {
            const tx = await task.setCustomVolumeLimit(token.address, newLimitToken.address, newAmount, newPeriod)
            await assertEvent(tx, 'CustomVolumeLimitSet', {
              token,
              limitToken: newLimitToken,
              amount: newAmount,
              period: newPeriod,
            })
          })
        })

        context('when there was some volume accrued', () => {
          beforeEach('accrue volume', async () => {
            const feed = await deployFeedMock(fp(1), 18)
            const setFeedRole = priceOracle.interface.getSighash('setFeed')
            await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
            await priceOracle.connect(owner).setFeed(token.address, limitToken.address, feed.address)
            await task.connect(owner).call(token.address, fp(1))
          })

          context('when the volume limit amount is being changed', () => {
            const rate = 2
            const newAmount = amount.mul(rate).mul(3)
            const newPeriod = period * rate
            let newLimitToken: Contract

            beforeEach('deploy new token', async () => {
              newLimitToken = await deployTokenMock('TKN')
              const feed = await deployFeedMock(fp(rate), 18)
              const setFeedRole = priceOracle.interface.getSighash('setFeed')
              await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
              await priceOracle.connect(owner).setFeed(limitToken.address, newLimitToken.address, feed.address)
            })

            it('sets the volume limit without updating the next reset time', async () => {
              const previousVolumeLimit = await task.customVolumeLimit(token.address)

              await task.setCustomVolumeLimit(token.address, newLimitToken.address, newAmount, newPeriod)

              const volumeLimit = await task.customVolumeLimit(token.address)
              expect(volumeLimit.limitToken).to.be.equal(newLimitToken.address)
              expect(volumeLimit.amount).to.be.equal(newAmount)
              expect(volumeLimit.period).to.be.equal(newPeriod)
              expect(volumeLimit.accrued).to.be.equal(previousVolumeLimit.accrued.mul(rate))
              expect(volumeLimit.nextResetTime).to.be.equal(previousVolumeLimit.nextResetTime)
            })

            it('emits an event', async () => {
              const tx = await task.setCustomVolumeLimit(token.address, newLimitToken.address, newAmount, newPeriod)
              await assertEvent(tx, 'CustomVolumeLimitSet', {
                token,
                limitToken: newLimitToken,
                amount: newAmount,
                period: newPeriod,
              })
            })
          })

          context('when the volume limit amount is being removed', () => {
            const newLimitToken = ZERO_ADDRESS
            const newAmount = 0
            const newPeriod = 0

            it('sets the volume limit and resets the totalizators', async () => {
              await task.setCustomVolumeLimit(token.address, newLimitToken, newAmount, newPeriod)

              const volumeLimit = await task.customVolumeLimit(token.address)
              expect(volumeLimit.limitToken).to.be.equal(newLimitToken)
              expect(volumeLimit.amount).to.be.equal(newAmount)
              expect(volumeLimit.period).to.be.equal(newPeriod)
              expect(volumeLimit.accrued).to.be.equal(0)
              expect(volumeLimit.nextResetTime).to.be.equal(0)
            })

            it('emits an event', async () => {
              const tx = await task.setCustomVolumeLimit(token.address, newLimitToken, newAmount, newPeriod)
              await assertEvent(tx, 'CustomVolumeLimitSet', {
                token,
                limitToken: newLimitToken,
                amount: newAmount,
                period: newPeriod,
              })
            })
          })
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setCustomVolumeLimit(ZERO_ADDRESS, ZERO_ADDRESS, 0, 0)).to.be.revertedWith(
          'AuthSenderNotAllowed'
        )
      })
    })
  })

  describe('call', () => {
    let token: Contract
    const amount = fp(10)

    beforeEach('deploy token', async () => {
      token = await deployTokenMock('TKN')
    })

    const itCanBeExecuted = () => {
      it('emits an Executed event', async () => {
        const tx = await task.call(token.address, amount)

        await assertEvent(tx, 'Executed')
      })
    }

    const itCannotBeExecuted = () => {
      it('reverts', async () => {
        await expect(task.call(token.address, amount)).to.be.revertedWith('TaskVolumeLimitExceeded')
      })
    }

    context('when the volume limit uses the same token', () => {
      const limit = amount.mul(3)
      const period = MONTH

      beforeEach('set volume limit', async () => {
        const setDefaultVolumeLimitRole = task.interface.getSighash('setDefaultVolumeLimit')
        await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultVolumeLimitRole, [])
        await task.connect(owner).setDefaultVolumeLimit(token.address, limit, period)
      })

      context('when the volume limit is not passed', () => {
        const accruedAmount = amount

        beforeEach('accrue some amount', async () => {
          await task.call(token.address, accruedAmount)
        })

        itCanBeExecuted()

        it('updates the accrued balance correctly', async () => {
          const previousVolumeLimit = await task.defaultVolumeLimit()

          await task.call(token.address, amount)

          const currentVolumeLimit = await task.defaultVolumeLimit()
          expect(currentVolumeLimit.accrued).to.be.equal(previousVolumeLimit.accrued.add(amount))
          expect(currentVolumeLimit.nextResetTime).to.be.equal(previousVolumeLimit.nextResetTime)
        })
      })

      context('when the volume limit is passed', () => {
        const accruedAmount = amount.mul(2).add(1)

        beforeEach('accrue some amount', async () => {
          await token.mint(smartVault.address, accruedAmount)
          await task.call(token.address, accruedAmount)
        })

        context('before the limit has been reset', () => {
          itCannotBeExecuted()
        })

        context('after the limit has been reset', () => {
          beforeEach('advance time', async () => {
            await advanceTime(period)
          })

          itCanBeExecuted()

          it('updates the accrued balance correctly', async () => {
            await task.call(token.address, amount)

            const currentVolumeLimit = await task.defaultVolumeLimit()
            expect(currentVolumeLimit.accrued).to.be.equal(amount)
            expect(currentVolumeLimit.nextResetTime).to.be.equal((await currentTimestamp()).add(period))
          })
        })
      })
    })

    context('when the volume limit uses another token', () => {
      let limitToken: Contract

      const limitRate = 4 // 1 token = 4 limit tokens
      const limit = amount.mul(limitRate).mul(2)
      const period = MONTH

      beforeEach('deploy new token', async () => {
        limitToken = await deployTokenMock('TKN')
        const feed = await deployFeedMock(fp(limitRate), 18)
        const setFeedRole = priceOracle.interface.getSighash('setFeed')
        await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
        await priceOracle.connect(owner).setFeed(token.address, limitToken.address, feed.address)
      })

      beforeEach('set volume limit', async () => {
        const setCustomVolumeLimitRole = task.interface.getSighash('setCustomVolumeLimit')
        await authorizer.connect(owner).authorize(owner.address, task.address, setCustomVolumeLimitRole, [])
        await task.connect(owner).setCustomVolumeLimit(token.address, limitToken.address, limit, period)
      })

      context('when the volume limit is not passed', () => {
        const accruedAmount = amount

        beforeEach('accrue some amount', async () => {
          await task.call(token.address, accruedAmount)
        })

        itCanBeExecuted()

        it('updates the accrued balance correctly', async () => {
          const previousVolumeLimit = await task.customVolumeLimit(token.address)

          await task.call(token.address, amount)

          const currentVolumeLimit = await task.customVolumeLimit(token.address)
          expect(currentVolumeLimit.accrued).to.be.equal(previousVolumeLimit.accrued.add(amount.mul(limitRate)))
          expect(currentVolumeLimit.nextResetTime).to.be.equal(previousVolumeLimit.nextResetTime)
        })
      })

      context('when the volume limit is passed', () => {
        const accruedAmount = amount.add(1)

        beforeEach('accrue some amount', async () => {
          await task.call(token.address, accruedAmount)
        })

        context('before the limit has been reset', () => {
          itCannotBeExecuted()
        })

        context('after the limit has been reset', () => {
          beforeEach('advance time', async () => {
            await advanceTime(period)
          })

          itCanBeExecuted()

          it('updates the accrued balance correctly', async () => {
            await task.call(token.address, amount)

            const currentVolumeLimit = await task.customVolumeLimit(token.address)
            expect(currentVolumeLimit.accrued).to.be.equal(amount.mul(limitRate))
            expect(currentVolumeLimit.nextResetTime).to.be.equal((await currentTimestamp()).add(period))
          })
        })
      })
    })
  })
})
