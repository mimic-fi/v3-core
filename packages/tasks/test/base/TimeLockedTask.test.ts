import {
  advanceTime,
  assertEvent,
  assertNoEvent,
  currentTimestamp,
  DAY,
  deployProxy,
  getSigners,
  MONTH,
  setNextBlockTimestamp,
  ZERO_BYTES32,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

import { deployEnvironment } from '../../src/setup'

describe('TimeLockedTask', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'TimeLockedTaskMock',
      [],
      [
        {
          baseConfig: {
            smartVault: smartVault.address,
            previousBalanceConnectorId: ZERO_BYTES32,
            nextBalanceConnectorId: ZERO_BYTES32,
          },
          timeLockConfig: {
            delay: 0,
            nextExecutionTimestamp: 0,
            executionPeriod: 0,
          },
        },
      ]
    )
  })

  describe('setTimeLockDelay', () => {
    const delay = MONTH

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setTimeLockDelayRole = task.interface.getSighash('setTimeLockDelay')
        await authorizer.connect(owner).authorize(owner.address, task.address, setTimeLockDelayRole, [])
        task = task.connect(owner)
      })

      context('when the delay is larger than the execution period', () => {
        const period = 0

        beforeEach('set execution period', async () => {
          const setTimeLockExecutionPeriodRole = task.interface.getSighash('setTimeLockExecutionPeriod')
          await authorizer.connect(owner).authorize(owner.address, task.address, setTimeLockExecutionPeriodRole, [])
          await task.setTimeLockExecutionPeriod(period)
        })

        it('sets the time lock delay', async () => {
          const previousExpiration = await task.timeLockExpiration()
          const previousTimeLockExecutionPeriod = await task.timeLockExecutionPeriod()

          await task.setTimeLockDelay(delay)

          expect(await task.timeLockDelay()).to.be.equal(delay)
          expect(await task.timeLockExpiration()).to.be.equal(previousExpiration)
          expect(await task.timeLockExecutionPeriod()).to.be.equal(previousTimeLockExecutionPeriod)
        })

        it('emits an event', async () => {
          const tx = await task.setTimeLockDelay(delay)

          await assertEvent(tx, 'TimeLockDelaySet', { delay })
        })
      })

      context('when the delay is shorter than the execution period', () => {
        const period = delay * 2

        beforeEach('set execution period', async () => {
          await task.setTimeLockDelay(period)
          const setTimeLockExecutionPeriodRole = task.interface.getSighash('setTimeLockExecutionPeriod')
          await authorizer.connect(owner).authorize(owner.address, task.address, setTimeLockExecutionPeriodRole, [])
          await task.setTimeLockExecutionPeriod(period)
        })

        it('reverts', async () => {
          await expect(task.setTimeLockDelay(delay)).to.be.revertedWith('TASK_DELAY_GT_EXECUTION_PERIOD')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setTimeLockDelay(delay)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setTimeLockExpiration', () => {
    const expiration = '123719273'

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setTimeLockExpirationRole = task.interface.getSighash('setTimeLockExpiration')
        await authorizer.connect(owner).authorize(owner.address, task.address, setTimeLockExpirationRole, [])
        task = task.connect(owner)
      })

      it('sets the time lock expiration', async () => {
        const previousTimeLockDelay = await task.timeLockDelay()
        const previousTimeLockExecutionPeriod = await task.timeLockExecutionPeriod()

        await task.setTimeLockExpiration(expiration)

        expect(await task.timeLockDelay()).to.be.equal(previousTimeLockDelay)
        expect(await task.timeLockExpiration()).to.be.equal(expiration)
        expect(await task.timeLockExecutionPeriod()).to.be.equal(previousTimeLockExecutionPeriod)
      })

      it('emits an event', async () => {
        const tx = await task.setTimeLockExpiration(expiration)

        await assertEvent(tx, 'TimeLockExpirationSet', { expiration })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setTimeLockExpiration(0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setTimeLockExecutionPeriod', () => {
    const period = MONTH

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setTimeLockExecutionPeriodRole = task.interface.getSighash('setTimeLockExecutionPeriod')
        await authorizer.connect(owner).authorize(owner.address, task.address, setTimeLockExecutionPeriodRole, [])
        task = task.connect(owner)
      })

      context('when the period is shorter than the delay', () => {
        const delay = period * 2

        beforeEach('set delay', async () => {
          const setTimeLockDelayRole = task.interface.getSighash('setTimeLockDelay')
          await authorizer.connect(owner).authorize(owner.address, task.address, setTimeLockDelayRole, [])
          await task.connect(owner).setTimeLockDelay(delay)
        })

        it('sets the time lock execution period', async () => {
          const previousTimeLockDelay = await task.timeLockDelay()
          const previousTimeLockExpiration = await task.timeLockExpiration()

          await task.setTimeLockExecutionPeriod(period)

          expect(await task.timeLockDelay()).to.be.equal(previousTimeLockDelay)
          expect(await task.timeLockExpiration()).to.be.equal(previousTimeLockExpiration)
          expect(await task.timeLockExecutionPeriod()).to.be.equal(period)
        })

        it('emits an event', async () => {
          const tx = await task.setTimeLockExecutionPeriod(period)

          await assertEvent(tx, 'TimeLockExecutionPeriodSet', { period })
        })
      })

      context('when the period is larger than the delay', () => {
        const delay = period / 2

        beforeEach('set delay', async () => {
          const setTimeLockDelayRole = task.interface.getSighash('setTimeLockDelay')
          await authorizer.connect(owner).authorize(owner.address, task.address, setTimeLockDelayRole, [])
          await task.connect(owner).setTimeLockDelay(delay)
        })

        it('reverts', async () => {
          await expect(task.setTimeLockExecutionPeriod(period)).to.be.revertedWith('TASK_EXECUTION_PERIOD_GT_DELAY')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setTimeLockExecutionPeriod(0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    beforeEach('authorize sender', async () => {
      const setTimeLockDelayRole = task.interface.getSighash('setTimeLockDelay')
      await authorizer.connect(owner).authorize(owner.address, task.address, setTimeLockDelayRole, [])
      const setTimeLockExpirationRole = task.interface.getSighash('setTimeLockExpiration')
      await authorizer.connect(owner).authorize(owner.address, task.address, setTimeLockExpirationRole, [])
      const setTimeLockExecutionPeriodRole = task.interface.getSighash('setTimeLockExecutionPeriod')
      await authorizer.connect(owner).authorize(owner.address, task.address, setTimeLockExecutionPeriodRole, [])
    })

    context('when no initial expiration timestamp is set', () => {
      const nextExecutionTimestamp = 0

      beforeEach('set time-lock expiration', async () => {
        await task.connect(owner).setTimeLockExpiration(nextExecutionTimestamp)
      })

      context('without time-lock delay', () => {
        const delay = 0

        beforeEach('set time-lock delay', async () => {
          await task.connect(owner).setTimeLockDelay(delay)
        })

        it('has no time-lock delay', async () => {
          expect(await task.timeLockDelay()).to.be.equal(0)
          expect(await task.timeLockExpiration()).to.be.equal(0)
        })

        it('has no initial delay', async () => {
          await expect(task.call()).not.to.be.reverted
        })

        it('does not update the expiration date', async () => {
          const tx = await task.call()
          await assertNoEvent(tx, 'TimeLockExpirationSet')

          expect(await task.timeLockDelay()).to.be.equal(0)
          expect(await task.timeLockExpiration()).to.be.equal(0)
          expect(await task.timeLockExecutionPeriod()).to.be.equal(0)
        })

        it('can be updated at any time in the future', async () => {
          const newTimeLockDelay = DAY
          await task.connect(owner).setTimeLockDelay(newTimeLockDelay)

          expect(await task.timeLockDelay()).to.be.equal(newTimeLockDelay)
          expect(await task.timeLockExpiration()).to.be.equal(0)
          expect(await task.timeLockExecutionPeriod()).to.be.equal(0)

          const tx = await task.call()
          await assertEvent(tx, 'TimeLockExpirationSet')
          await expect(task.call()).to.be.revertedWith('TASK_TIME_LOCK_NOT_EXPIRED')

          const previousExpiration = await task.timeLockExpiration()
          await advanceTime(newTimeLockDelay)
          const tx2 = await task.call()
          await assertEvent(tx2, 'TimeLockExpirationSet')

          expect(await task.timeLockDelay()).to.be.equal(newTimeLockDelay)
          expect(await task.timeLockExpiration()).to.be.equal(previousExpiration.add(newTimeLockDelay))
          expect(await task.timeLockExecutionPeriod()).to.be.equal(0)
        })
      })

      context('with an initial delay', () => {
        const delay = MONTH

        beforeEach('set time-lock delay', async () => {
          await task.connect(owner).setTimeLockDelay(delay)
        })

        it('has a time-lock delay', async () => {
          expect(await task.timeLockDelay()).to.be.equal(delay)
          expect(await task.timeLockExpiration()).to.be.equal(0)
        })

        it('has no initial delay', async () => {
          await expect(task.call()).not.to.be.reverted
        })

        it('must wait to be valid again after the first execution', async () => {
          await task.call()
          await expect(task.call()).to.be.revertedWith('TASK_TIME_LOCK_NOT_EXPIRED')

          const previousExpiration = await task.timeLockExpiration()
          await advanceTime(delay)
          const tx = await task.call()
          await assertEvent(tx, 'TimeLockExpirationSet')

          expect(await task.timeLockDelay()).to.be.equal(delay)
          expect(await task.timeLockExpiration()).to.be.equal(previousExpiration.add(delay))
        })

        it('can be changed at any time in the future without affecting the previous expiration date', async () => {
          await task.call()
          const initialExpiration = await task.timeLockExpiration()

          const newTimeLockDelay = DAY
          await task.connect(owner).setTimeLockDelay(newTimeLockDelay)

          expect(await task.timeLockDelay()).to.be.equal(newTimeLockDelay)
          expect(await task.timeLockExpiration()).to.be.equal(initialExpiration)

          const secondExpiration = await task.timeLockExpiration()
          await setNextBlockTimestamp(secondExpiration)
          const tx = await task.call()
          await assertEvent(tx, 'TimeLockExpirationSet')

          expect(await task.timeLockDelay()).to.be.equal(newTimeLockDelay)
          expect(await task.timeLockExpiration()).to.be.equal(secondExpiration.add(newTimeLockDelay))
        })

        it('can be unset at any time in the future without affecting the previous expiration date', async () => {
          await task.call()
          const initialExpiration = await task.timeLockExpiration()

          await task.connect(owner).setTimeLockDelay(0)

          expect(await task.timeLockDelay()).to.be.equal(0)
          expect(await task.timeLockExpiration()).to.be.equal(initialExpiration)

          const secondExpiration = await task.timeLockExpiration()
          await setNextBlockTimestamp(initialExpiration)
          const tx = await task.call()
          await assertNoEvent(tx, 'TimeLockExpirationSet')

          expect(await task.timeLockDelay()).to.be.equal(0)
          expect(await task.timeLockExpiration()).to.be.equal(secondExpiration)
        })
      })
    })

    context('when an initial expiration timestamp is set', () => {
      let initialExpirationTimestamp: BigNumber
      const initialDelay = 2 * MONTH

      beforeEach('set time-lock expiration', async () => {
        initialExpirationTimestamp = (await currentTimestamp()).add(initialDelay)
        await task.connect(owner).setTimeLockExpiration(initialExpirationTimestamp)
      })

      context('without time-lock delay', () => {
        const delay = 0

        beforeEach('set time-lock delay', async () => {
          await task.connect(owner).setTimeLockDelay(delay)
        })

        it('has an initial expiration timestamp', async () => {
          expect(await task.timeLockDelay()).to.be.equal(0)
          expect(await task.timeLockExpiration()).to.be.equal(initialExpirationTimestamp)
        })

        it('can be validated any number of times right after the initial delay', async () => {
          const initialDelay = await task.timeLockDelay()
          const initialExpiration = await task.timeLockExpiration()

          await expect(task.call()).to.be.revertedWith('TASK_TIME_LOCK_NOT_EXPIRED')

          await advanceTime(initialExpirationTimestamp)
          const tx = await task.call()
          await assertNoEvent(tx, 'TimeLockExpirationSet')

          expect(await task.timeLockDelay()).to.be.equal(initialDelay)
          expect(await task.timeLockExpiration()).to.be.equal(initialExpiration)
        })

        it('can be changed at any time in the future without affecting the previous expiration date', async () => {
          const initialExpiration = await task.timeLockExpiration()

          const newTimeLockDelay = DAY
          await task.connect(owner).setTimeLockDelay(newTimeLockDelay)

          expect(await task.timeLockDelay()).to.be.equal(newTimeLockDelay)
          expect(await task.timeLockExpiration()).to.be.equal(initialExpiration)

          await setNextBlockTimestamp(initialExpiration)
          const tx = await task.call()
          await assertEvent(tx, 'TimeLockExpirationSet')

          const now = await currentTimestamp()
          expect(await task.timeLockDelay()).to.be.equal(newTimeLockDelay)
          expect(await task.timeLockExpiration()).to.be.equal(now.add(newTimeLockDelay))
        })
      })

      context('with a time-lock delay', () => {
        const delay = MONTH
        const executionPeriod = DAY

        beforeEach('set time-lock delay and execution period', async () => {
          await task.connect(owner).setTimeLockDelay(delay)
          await task.connect(owner).setTimeLockExecutionPeriod(executionPeriod)
        })

        it('has a time-lock with an initial delay', async () => {
          expect(await task.timeLockDelay()).to.be.equal(delay)
          expect(await task.timeLockExpiration()).to.be.equal(initialExpirationTimestamp)
          expect(await task.timeLockExecutionPeriod()).to.be.equal(executionPeriod)
        })

        it('can be validated once right after the initial delay', async () => {
          await expect(task.call()).to.be.revertedWith('TASK_TIME_LOCK_NOT_EXPIRED')

          await setNextBlockTimestamp(initialExpirationTimestamp)
          const tx = await task.call()
          await assertEvent(tx, 'TimeLockExpirationSet')

          expect(await task.timeLockDelay()).to.be.equal(delay)
          expect(await task.timeLockExpiration()).to.be.equal(initialExpirationTimestamp.add(delay))
          expect(await task.timeLockExecutionPeriod()).to.be.equal(executionPeriod)

          await expect(task.call()).to.be.revertedWith('TASK_TIME_LOCK_NOT_EXPIRED')

          await setNextBlockTimestamp(initialExpirationTimestamp.add(delay * 2).add(executionPeriod))
          const tx2 = await task.call()
          await assertEvent(tx2, 'TimeLockExpirationSet')

          expect(await task.timeLockDelay()).to.be.equal(delay)
          expect(await task.timeLockExpiration()).to.be.equal(initialExpirationTimestamp.add(delay * 3))
          expect(await task.timeLockExecutionPeriod()).to.be.equal(executionPeriod)
        })

        it('cannot be validated after the execution period', async () => {
          await expect(task.call()).to.be.revertedWith('TASK_TIME_LOCK_NOT_EXPIRED')

          await setNextBlockTimestamp(initialExpirationTimestamp.add(executionPeriod).add(1))
          await expect(task.call()).to.be.revertedWith('TASK_TIME_LOCK_WAIT_NEXT_PERIOD')

          await setNextBlockTimestamp(initialExpirationTimestamp.add(delay))
          const tx = await task.call()
          await assertEvent(tx, 'TimeLockExpirationSet')

          expect(await task.timeLockDelay()).to.be.equal(delay)
          expect(await task.timeLockExpiration()).to.be.equal(initialExpirationTimestamp.add(delay * 2))
          expect(await task.timeLockExecutionPeriod()).to.be.equal(executionPeriod)

          await expect(task.call()).to.be.revertedWith('TASK_TIME_LOCK_NOT_EXPIRED')
        })

        it('can be changed at any time in the future without affecting the previous expiration date', async () => {
          const newTimeLockDelay = DAY
          await task.connect(owner).setTimeLockDelay(newTimeLockDelay)

          expect(await task.timeLockDelay()).to.be.equal(newTimeLockDelay)
          expect(await task.timeLockExpiration()).to.be.equal(initialExpirationTimestamp)
          expect(await task.timeLockExecutionPeriod()).to.be.equal(executionPeriod)

          await setNextBlockTimestamp(initialExpirationTimestamp)
          const tx = await task.call()
          await assertEvent(tx, 'TimeLockExpirationSet')

          expect(await task.timeLockDelay()).to.be.equal(newTimeLockDelay)
          expect(await task.timeLockExpiration()).to.be.equal(initialExpirationTimestamp.add(newTimeLockDelay))
          expect(await task.timeLockExecutionPeriod()).to.be.equal(executionPeriod)
        })

        it('can be unset at any time in the future without affecting the previous expiration date', async () => {
          await task.connect(owner).setTimeLockExecutionPeriod(0)
          await task.connect(owner).setTimeLockDelay(0)

          expect(await task.timeLockDelay()).to.be.equal(0)
          expect(await task.timeLockExpiration()).to.be.equal(initialExpirationTimestamp)

          await setNextBlockTimestamp(initialExpirationTimestamp)
          const tx = await task.call()
          await assertNoEvent(tx, 'TimeLockExpirationSet')

          expect(await task.timeLockDelay()).to.be.equal(0)
          expect(await task.timeLockExpiration()).to.be.equal(initialExpirationTimestamp)
        })
      })
    })
  })
})
