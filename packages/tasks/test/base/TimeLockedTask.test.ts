import {
  advanceTime,
  assertEvent,
  BigNumberish,
  currentTimestamp,
  DAY,
  deployProxy,
  getSigners,
  HOUR,
  MINUTE,
  setNextBlockTimestamp,
  ZERO_BYTES32,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { deployEnvironment } from '../../src/setup'

/* eslint-disable no-secrets/no-secrets */

const MODE = {
  SECONDS: 0,
  ON_DAY: 1,
  ON_LAST_DAY: 2,
  EVERY_X_MONTH: 3,
}

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
            mode: 0,
            frequency: 0,
            allowedAt: 0,
            window: 0,
          },
        },
      ]
    )
  })

  describe('setTimeLock', () => {
    context('when the sender is allowed', () => {
      beforeEach('authorize sender', async () => {
        const setTimeLockRole = task.interface.getSighash('setTimeLock')
        await authorizer.connect(owner).authorize(owner.address, task.address, setTimeLockRole, [])
        task = task.connect(owner)
      })

      function itSetsTheTimeLockProperly(mode: number, frequency: number, allowedAt: number, window: number) {
        it('sets the time lock', async () => {
          await task.setTimeLock(mode, frequency, allowedAt, window)

          const timeLock = await task.getTimeLock()
          expect(timeLock.mode).to.be.equal(mode)
          expect(timeLock.frequency).to.be.equal(frequency)
          expect(timeLock.allowedAt).to.be.equal(allowedAt)
          expect(timeLock.window).to.be.equal(window)
        })

        it('emits an event', async () => {
          const tx = await task.setTimeLock(mode, frequency, allowedAt, window)

          await assertEvent(tx, 'TimeLockSet', { mode, frequency, allowedAt, window })
        })
      }

      function itReverts(mode: number, frequency: number, allowedAt: number, window: number, error: string) {
        it('reverts', async () => {
          await expect(task.setTimeLock(mode, frequency, allowedAt, window)).to.be.revertedWith(error)
        })
      }

      context('seconds mode', () => {
        const mode = MODE.SECONDS

        context('when a frequency is given', () => {
          const frequency = 100

          context('when a window is given', () => {
            context('when the window is shorter than the frequency', () => {
              const window = frequency - 1

              context('when an allowed date is given', () => {
                const allowedAt = 1000

                itSetsTheTimeLockProperly(mode, frequency, allowedAt, window)
              })

              context('when no allowed date is given', () => {
                const allowedAt = 0

                itReverts(mode, frequency, allowedAt, window, 'TaskInvalidAllowedDate')
              })
            })

            context('when the window is larger than the frequency', () => {
              const window = frequency + 1

              itReverts(mode, frequency, 0, window, 'TaskInvalidAllowedWindow')
            })
          })

          context('when no window is given', () => {
            const window = 0

            context('when an allowed date is given', () => {
              const allowedAt = 1000

              itReverts(mode, frequency, allowedAt, window, 'TaskInvalidAllowedWindow')
            })

            context('when no allowed date is given', () => {
              const allowedAt = 0

              itSetsTheTimeLockProperly(mode, frequency, allowedAt, window)
            })
          })
        })

        context('when no frequency is given', () => {
          const frequency = 0

          context('when a window is given', () => {
            const window = 10

            context('when an allowed date is given', () => {
              const allowedAt = 1000

              itReverts(mode, frequency, allowedAt, window, 'TaskInvalidFrequency')
            })

            context('when no allowed date is given', () => {
              const allowedAt = 0

              itReverts(mode, frequency, allowedAt, window, 'TaskInvalidFrequency')
            })
          })

          context('when no window is given', () => {
            const window = 0

            context('when an allowed date is given', () => {
              const allowedAt = 1000

              itReverts(mode, frequency, allowedAt, window, 'TaskInvalidFrequency')
            })

            context('when no allowed date is given', () => {
              const allowedAt = 0

              itSetsTheTimeLockProperly(mode, frequency, allowedAt, window)
            })
          })
        })
      })

      context('on-day mode', () => {
        const mode = MODE.ON_DAY

        context('when a frequency is given', () => {
          context('when the frequency is lower than or equal to 28', () => {
            const frequency = 28

            context('when a window is given', () => {
              context('when the window is shorter than the frequency', () => {
                const window = frequency * DAY - 1

                context('when an allowed date is given', () => {
                  context('when the allowed day matches the frequency', () => {
                    const allowedAt = new Date(`2023-10-${frequency}`).getTime() / 1000

                    itSetsTheTimeLockProperly(mode, frequency, allowedAt, window)
                  })

                  context('when the allowed day does not match the frequency', () => {
                    const allowedAt = new Date(`2023-10-${frequency + 1}`).getTime() / 1000

                    itReverts(mode, frequency, allowedAt, window, 'TaskInvalidAllowedDate')
                  })
                })

                context('when no allowed date is given', () => {
                  const allowedAt = 0

                  itReverts(mode, frequency, allowedAt, window, 'TaskInvalidAllowedDate')
                })
              })

              context('when the window is larger than the frequency', () => {
                const window = frequency * DAY + 1

                itReverts(mode, frequency, 0, window, 'TaskInvalidAllowedWindow')
              })
            })

            context('when no window is given', () => {
              const window = 0

              itReverts(mode, frequency, 0, window, 'TaskInvalidAllowedWindow')
            })
          })

          context('when the frequency is greater than 28', () => {
            const frequency = 29

            itReverts(mode, frequency, 0, 0, 'TaskInvalidFrequency')
          })
        })

        context('when no frequency is given', () => {
          const frequency = 0

          itReverts(mode, frequency, 0, 0, 'TaskInvalidFrequency')
        })
      })

      context('on-last-day mode', () => {
        const mode = MODE.ON_LAST_DAY

        context('when a frequency is given', () => {
          const frequency = 1

          itReverts(mode, frequency, 0, 0, 'TaskInvalidFrequency')
        })

        context('when no frequency is given', () => {
          const frequency = 0

          context('when a window is given', () => {
            context('when the window is shorter than 28 days', () => {
              const window = 28 * DAY - 1

              context('when an allowed date is given', () => {
                context('when the allowed date is a last day of a month', () => {
                  const allowedDates = ['2022-06-30', '2023-10-31', '2021-12-31', '2020-02-29', '2021-02-28']

                  allowedDates.forEach((date) => {
                    context(`for ${date}`, () => {
                      const allowedAt = new Date(date).getTime() / 1000

                      itSetsTheTimeLockProperly(mode, frequency, allowedAt, window)
                    })
                  })
                })

                context('when the allowed date is not the last day of a month', () => {
                  const notAllowedDates = ['2022-08-30', '2020-02-28']

                  notAllowedDates.forEach((date) => {
                    context(`for ${date}`, () => {
                      const allowedAt = new Date(date).getTime() / 1000

                      itReverts(mode, frequency, allowedAt, window, 'TaskInvalidAllowedDate')
                    })
                  })
                })
              })

              context('when no allowed date is given', () => {
                const allowedAt = 0

                itReverts(mode, frequency, allowedAt, window, 'TaskInvalidAllowedDate')
              })
            })

            context('when the window is larger than 28 days', () => {
              const window = 28 * DAY + 1

              itReverts(mode, frequency, 0, window, 'TaskInvalidAllowedWindow')
            })
          })

          context('when no window is given', () => {
            const window = 0

            itReverts(mode, frequency, 0, window, 'TaskInvalidAllowedWindow')
          })
        })
      })

      context('every-month mode', () => {
        const mode = MODE.EVERY_X_MONTH

        context('when a frequency is given', () => {
          const frequency = 3

          context('when a window is given', () => {
            context('when the window is shorter than months of 28 days', () => {
              const window = 28 * DAY * frequency - 1

              context('when an allowed date is given', () => {
                context('when the allowed day is lower than or equal to 28', () => {
                  const allowedDates = ['2022-06-10', '2023-10-01', '2021-02-28']

                  allowedDates.forEach((date) => {
                    context(`for ${date}`, () => {
                      const allowedAt = new Date(date).getTime() / 1000

                      itSetsTheTimeLockProperly(mode, frequency, allowedAt, window)
                    })
                  })
                })

                context('when the allowed day is greater than 28', () => {
                  const notAllowedDates = ['2022-08-30', '2020-02-29', '2023-10-31', '2023-06-30']

                  notAllowedDates.forEach((date) => {
                    context(`for ${date}`, () => {
                      const allowedAt = new Date(date).getTime() / 1000

                      itReverts(mode, frequency, allowedAt, window, 'TaskInvalidAllowedDate')
                    })
                  })
                })
              })

              context('when no allowed date is given', () => {
                const allowedAt = 0

                itReverts(mode, frequency, allowedAt, window, 'TaskInvalidAllowedDate')
              })
            })

            context('when the window is larger than months of 28 days', () => {
              const window = 28 * DAY * frequency + 1

              itReverts(mode, frequency, 0, window, 'TaskInvalidAllowedWindow')
            })
          })

          context('when no window is given', () => {
            const window = 0

            itReverts(mode, frequency, 0, window, 'TaskInvalidAllowedWindow')
          })
        })

        context('when no frequency is given', () => {
          const frequency = 0

          itReverts(mode, frequency, 0, 0, 'TaskInvalidFrequency')
        })
      })

      context('on another mode', () => {
        const mode = 888999

        it('reverts', async () => {
          await expect(task.setTimeLock(mode, 0, 0, 0)).to.be.reverted
        })
      })
    })

    context('when the sender is not allowed', () => {
      it('reverts', async () => {
        await expect(task.setTimeLock(0, 0, 0, 0)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('call', () => {
    beforeEach('authorize sender', async () => {
      const setTimeLockRole = task.interface.getSighash('setTimeLock')
      await authorizer.connect(owner).authorize(owner.address, task.address, setTimeLockRole, [])
      task = task.connect(owner)
    })

    async function assertItCannotBeExecuted() {
      await expect(task.call()).to.be.revertedWith('TaskTimeLockActive')
    }

    async function assertItCanBeExecuted(expectedNextAllowedDate: BigNumberish) {
      const tx = await task.call()
      await assertEvent(tx, 'TimeLockAllowedAtSet', { allowedAt: expectedNextAllowedDate })

      const { allowedAt } = await task.getTimeLock()
      expect(allowedAt).to.be.equal(expectedNextAllowedDate)
    }

    async function moveToDate(timestamp: string, delta = 0): Promise<void> {
      const date = new Date(`${timestamp}T00:00:00Z`).getTime() / 1000
      const now = await currentTimestamp()
      const diff = date - now.toNumber() + delta
      await advanceTime(diff)
    }

    context('seconds mode', () => {
      const mode = MODE.SECONDS
      const frequency = HOUR * 2

      async function getNextAllowedDate(delayed: number) {
        const previousTimeLock = await task.getTimeLock()
        const now = await currentTimestamp()
        return (previousTimeLock.window.eq(0) ? now : previousTimeLock.allowedAt).add(delayed)
      }

      context('without execution window', () => {
        const window = 0
        const allowedAt = 0

        beforeEach('set time lock', async () => {
          await task.setTimeLock(mode, frequency, allowedAt, window)
        })

        it('locks the task properly', async () => {
          // It can be executed immediately
          await assertItCanBeExecuted(await getNextAllowedDate(frequency + 1))

          // It is locked for a period equal to the frequency set
          await assertItCannotBeExecuted()
          await advanceTime(frequency / 2)
          await assertItCannotBeExecuted()
          await advanceTime(frequency / 2)
          await assertItCanBeExecuted(await getNextAllowedDate(frequency + 1))

          // It is locked for a period equal to the frequency set again
          await assertItCannotBeExecuted()
          await advanceTime(frequency - 10)
          await assertItCannotBeExecuted()

          // It can be executed at any point in time in the future
          await advanceTime(frequency * 1000)
          await assertItCanBeExecuted(await getNextAllowedDate(frequency + 1))
        })
      })

      context('with execution window', () => {
        const window = MINUTE * 30
        const allowedAt = new Date('2023-10-05').getTime() / 1000

        beforeEach('set time lock', async () => {
          await task.setTimeLock(mode, frequency, allowedAt, window)
        })

        it('locks the task properly', async () => {
          // Move to an executable window
          const now = await currentTimestamp()
          const periods = now.sub(allowedAt).div(frequency).toNumber()
          const nextAllowedDate = allowedAt + (periods + 1) * frequency
          await setNextBlockTimestamp(nextAllowedDate)

          // It can be executed immediately
          await assertItCanBeExecuted(await getNextAllowedDate(frequency * (periods + 2)))

          // It is locked for a period equal to the frequency set
          await assertItCannotBeExecuted()
          await advanceTime(frequency / 2)
          await assertItCannotBeExecuted()
          await advanceTime(frequency / 2)
          await assertItCanBeExecuted(await getNextAllowedDate(frequency))

          // It is locked for a period equal to the frequency set again
          await assertItCannotBeExecuted()
          await advanceTime(frequency - 10)
          await assertItCannotBeExecuted()

          // It cannot be executed after the execution window
          const timeLock = await task.getTimeLock()
          await setNextBlockTimestamp(timeLock.allowedAt.add(window).add(1))
          await assertItCannotBeExecuted()

          // It can be executed one period after
          await setNextBlockTimestamp(timeLock.allowedAt.add(frequency))
          await assertItCanBeExecuted(await getNextAllowedDate(frequency * 2))
        })
      })
    })

    context('on-day mode', () => {
      const mode = MODE.ON_DAY
      const frequency = 5
      const allowedAt = new Date('2028-10-05T00:00:00Z').getTime() / 1000
      const window = 1 * DAY

      beforeEach('set time lock', async () => {
        await task.setTimeLock(mode, frequency, allowedAt, window)
      })

      async function getNextAllowedDate(): Promise<number> {
        const now = new Date((await currentTimestamp()).toNumber() * 1000)
        const month = now.getMonth()
        const nextMonth = (month + 1) % 12
        const nextYear = nextMonth > month ? now.getFullYear() : now.getFullYear() + 1
        return new Date(`${nextYear}-${(nextMonth + 1).toString().padStart(2, '0')}-05T00:00:00Z`).getTime() / 1000
      }

      it('locks the task properly', async () => {
        // Move to an executable window
        await moveToDate('2028-10-05')

        // It can be executed immediately
        await assertItCanBeExecuted(await getNextAllowedDate())

        // It is locked for at least a month
        await assertItCannotBeExecuted()
        await moveToDate('2028-10-20')
        await assertItCannotBeExecuted()

        // It cannot be executed after the execution window
        await moveToDate('2028-11-05', window + 1)
        await assertItCannotBeExecuted()

        // It can be executed one period after
        await moveToDate('2028-12-05', window - 10)
        await assertItCanBeExecuted(await getNextAllowedDate())
      })
    })

    context('on-last-day mode', () => {
      const mode = MODE.ON_LAST_DAY
      const frequency = 0
      const allowedAt = new Date('2030-10-31T00:00:00Z').getTime() / 1000
      const window = 1 * DAY

      beforeEach('set time lock', async () => {
        await task.setTimeLock(mode, frequency, allowedAt, window)
      })

      async function getNextAllowedDate(): Promise<number> {
        const now = new Date((await currentTimestamp()).toNumber() * 1000)
        const month = now.getMonth()
        const nextMonth = (month + 1) % 12
        const nextYear = nextMonth > month ? now.getFullYear() : now.getFullYear() + 1
        const lastDayOfMonth = new Date(nextYear, nextMonth + 1, 0).getDate()
        const date = `${nextYear}-${(nextMonth + 1).toString().padStart(2, '0')}-${lastDayOfMonth}T00:00:00Z`
        return new Date(date).getTime() / 1000
      }

      it('locks the task properly', async () => {
        // Move to an executable window
        await moveToDate('2030-10-31')

        // It can be executed immediately
        await assertItCanBeExecuted(await getNextAllowedDate())

        // It is locked for at least a month
        await assertItCannotBeExecuted()
        await moveToDate('2030-11-20')
        await assertItCannotBeExecuted()

        // It cannot be executed after the execution window
        await moveToDate('2030-12-31', window + 1)
        await assertItCannotBeExecuted()

        // It can be executed one period after
        await moveToDate('2031-01-31', window - 10)
        await assertItCanBeExecuted(await getNextAllowedDate())
      })
    })

    context('every-month mode', () => {
      const mode = MODE.EVERY_X_MONTH
      const frequency = 3
      const allowedAt = new Date('2032-10-06T00:00:00Z').getTime() / 1000
      const window = 1 * DAY

      beforeEach('set time lock', async () => {
        await task.setTimeLock(mode, frequency, allowedAt, window)
      })

      async function getNextAllowedDate(): Promise<number> {
        const now = new Date((await currentTimestamp()).toNumber() * 1000)
        const month = now.getMonth()
        const nextMonth = (month + frequency) % 12
        const nextYear = nextMonth > month ? now.getFullYear() : now.getFullYear() + 1
        return new Date(`${nextYear}-${(nextMonth + 1).toString().padStart(2, '0')}-06T00:00:00Z`).getTime() / 1000
      }

      it('locks the task properly', async () => {
        // Move to an executable window
        await moveToDate('2032-10-06')

        // It can be executed immediately
        await assertItCanBeExecuted(await getNextAllowedDate())

        // It is locked for at least the number of set months
        await assertItCannotBeExecuted()
        await moveToDate('2032-11-06')
        await assertItCannotBeExecuted()
        await moveToDate('2032-12-06')
        await assertItCannotBeExecuted()

        // It cannot be executed after the execution window
        await moveToDate('2033-01-06', window + 1)
        await assertItCannotBeExecuted()

        // It can be executed one period after
        await moveToDate('2033-04-06', window - 1)
        await assertItCanBeExecuted(await getNextAllowedDate())
      })
    })
  })
})
