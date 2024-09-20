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
  ZERO_BYTES32,
} from '@mimic-fi/helpers'
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
          const frequency = 10

          context('when a window is given', () => {
            context('when the window is shorter than months of 28 days', () => {
              const window = frequency * DAY * 28 - 1

              context('when an allowed date is given', () => {
                context('when the allowed date day is lower than or equal to 28', () => {
                  const allowedDates = ['2022-06-01', '2023-10-11', '2021-12-21', '2020-02-28']

                  allowedDates.forEach((date) => {
                    context(`for ${date}`, () => {
                      const allowedAt = new Date(date).getTime() / 1000

                      itSetsTheTimeLockProperly(mode, frequency, allowedAt, window)
                    })
                  })
                })

                context('when the allowed date day is not greater than 28', () => {
                  const notAllowedDates = ['2022-08-30', '2032-02-29', '2020-07-31']

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
              const window = frequency * DAY * 28 + 1

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

      context('on-last-day mode', () => {
        const mode = MODE.ON_LAST_DAY

        context('when a frequency is given', () => {
          const frequency = 10

          context('when a window is given', () => {
            context('when the window is shorter than months of 28 days', () => {
              const window = 28 * DAY * frequency - 1

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

    async function setInitialTimeLock(mode: number, frequency: BigNumberish, timestamp: string, window: number) {
      const allowedAt = new Date(timestamp).getTime() / 1000
      await task.setTimeLock(mode, frequency, allowedAt, window)
    }

    async function moveToDate(timestamp: string, delta = 0): Promise<void> {
      const date = new Date(timestamp).getTime() / 1000
      const now = await currentTimestamp()
      const diff = date - now.toNumber() + delta
      await advanceTime(diff)
    }

    async function assertItCannotBeExecuted(currentAllowedTimestamp: string) {
      await expect(task.call()).to.be.revertedWith('TaskTimeLockActive')

      const { allowedAt } = await task.getTimeLock()
      expect(new Date(allowedAt * 1000)).to.be.deep.equal(new Date(currentAllowedTimestamp))
    }

    async function assertItCanBeExecuted(nextAllowedTimestamp: string) {
      const tx = await task.call()

      const { allowedAt } = await task.getTimeLock()
      expect(new Date(allowedAt * 1000)).to.be.deep.equal(new Date(nextAllowedTimestamp))

      const expectedNextAllowedDate = new Date(nextAllowedTimestamp).getTime() / 1000
      await assertEvent(tx, 'TimeLockAllowedAtSet', { allowedAt: expectedNextAllowedDate })
    }

    context('seconds mode', () => {
      const mode = MODE.SECONDS
      const frequency = HOUR * 2

      context('without execution window', () => {
        const window = 0
        const allowedAt = 0

        it('locks the task properly', async () => {
          // It can be executed immediately
          await task.setTimeLock(mode, frequency, allowedAt, window)
          await moveToDate('2025-01-01T10:20:29Z')

          // Note the allowed date is off 1 second, that's correct since there is no initial allowed date,
          // it simply uses the current timestamp which is mined one second after the previous block.
          await assertItCanBeExecuted('2025-01-01T12:20:30Z')

          // It is locked for a period equal to the frequency set
          await assertItCannotBeExecuted('2025-01-01T12:20:30Z')
          await moveToDate('2025-01-01T11:20:30Z')
          await assertItCannotBeExecuted('2025-01-01T12:20:30Z')
          await moveToDate('2025-01-01T12:20:29Z')
          await assertItCanBeExecuted('2025-01-01T14:20:30Z')

          // It is locked for a period equal to the frequency set again
          await assertItCannotBeExecuted('2025-01-01T14:20:30Z')
          await moveToDate('2025-01-01T14:20:28Z')
          await assertItCannotBeExecuted('2025-01-01T14:20:30Z')

          // It can be executed at any point in time in the future
          await moveToDate('2026-01-01T01:02:03Z')
          await assertItCanBeExecuted('2026-01-01T03:02:04Z')
        })
      })

      context('with execution window', () => {
        const window = MINUTE * 30
        const allowedAt = new Date('2026-06-01T08:22:34Z').getTime() / 1000

        it('locks the task properly', async () => {
          // It can be executed immediately
          await task.setTimeLock(mode, frequency, allowedAt, window)
          await moveToDate('2026-06-01T08:22:34Z')
          await assertItCanBeExecuted('2026-06-01T10:22:34Z')

          // It is locked for a period equal to the frequency set
          await assertItCannotBeExecuted('2026-06-01T10:22:34Z')
          await moveToDate('2026-06-01T09:22:34Z')
          await assertItCannotBeExecuted('2026-06-01T10:22:34Z')
          await moveToDate('2026-06-01T10:22:34Z')
          await assertItCanBeExecuted('2026-06-01T12:22:34Z')

          // It is locked for a period equal to the frequency set again
          await assertItCannotBeExecuted('2026-06-01T12:22:34Z')
          await moveToDate('2026-06-01T12:20:34Z')
          await assertItCannotBeExecuted('2026-06-01T12:22:34Z')

          // It cannot be executed after the execution window
          await moveToDate('2026-06-01T12:52:35Z')
          await assertItCannotBeExecuted('2026-06-01T12:22:34Z')

          // It can be executed one period after
          await moveToDate('2026-06-01T14:22:34Z')
          await assertItCanBeExecuted('2026-06-01T16:22:34Z')
        })
      })
    })

    context('on-day mode', () => {
      const mode = MODE.ON_DAY

      context('with 1 month frequency', () => {
        const frequency = 1

        it('locks the task properly', async () => {
          // Move to an executable window
          await setInitialTimeLock(mode, frequency, '2028-10-05T01:02:03Z', DAY)
          await moveToDate('2028-10-05T01:02:03Z')

          // It can be executed immediately
          await assertItCanBeExecuted('2028-11-05T01:02:03Z')

          // It is locked for at least a month
          await assertItCannotBeExecuted('2028-11-05T01:02:03Z')
          await moveToDate('2028-10-20T01:02:03Z')
          await assertItCannotBeExecuted('2028-11-05T01:02:03Z')

          // It cannot be executed after the execution window
          await moveToDate('2028-11-06T01:02:03Z')
          await assertItCannotBeExecuted('2028-11-05T01:02:03Z')

          // It can be executed one period after
          await moveToDate('2028-12-05T01:02:03Z')
          await assertItCanBeExecuted('2029-01-05T01:02:03Z')
        })
      })

      context('with 2 months frequency', () => {
        const frequency = 2

        it('locks the task properly', async () => {
          // Move to an executable window
          await setInitialTimeLock(mode, frequency, '2032-01-01T10:05:20Z', DAY)
          await moveToDate('2032-01-01T10:05:20Z')

          // It can be executed immediately
          await assertItCanBeExecuted('2032-03-01T10:05:20Z')

          // It is locked for at least the number of set months
          await assertItCannotBeExecuted('2032-03-01T10:05:20Z')
          await moveToDate('2032-02-01T10:05:20Z')
          await assertItCannotBeExecuted('2032-03-01T10:05:20Z')
          await moveToDate('2032-02-28T10:05:20Z')
          await assertItCannotBeExecuted('2032-03-01T10:05:20Z')

          // It cannot be executed after the execution window
          await moveToDate('2032-03-02T10:05:21Z')
          await assertItCannotBeExecuted('2032-03-01T10:05:20Z')

          // It can be executed one period after
          await moveToDate('2032-05-02T10:05:19Z')
          await assertItCanBeExecuted('2032-07-01T10:05:20Z')

          // Change time lock to 24 months
          await setInitialTimeLock(mode, 24, '2033-01-01T05:04:03Z', DAY)
          await assertItCannotBeExecuted('2033-01-01T05:04:03Z')

          // Move to an executable window
          await moveToDate('2033-01-01T05:04:03Z')
          await assertItCanBeExecuted('2035-01-01T05:04:03Z')
        })
      })
    })

    context('on-last-day mode', () => {
      const mode = MODE.ON_LAST_DAY

      context('with 1 month frequency', () => {
        const frequency = 1

        it('locks the task properly', async () => {
          // Move to an executable window
          await setInitialTimeLock(mode, frequency, '2030-10-31T10:32:20Z', DAY)
          await moveToDate('2030-10-31T10:32:20Z')

          // It can be executed immediately
          await assertItCanBeExecuted('2030-11-30T10:32:20Z')

          // It is locked for at least a month
          await assertItCannotBeExecuted('2030-11-30T10:32:20Z')
          await moveToDate('2030-11-20T10:32:20Z')
          await assertItCannotBeExecuted('2030-11-30T10:32:20Z')

          // It cannot be executed after the execution window
          await moveToDate('2031-01-01T10:32:20Z')
          await assertItCannotBeExecuted('2030-11-30T10:32:20Z')

          // It can be executed one period after
          await moveToDate('2031-01-31T10:32:20Z')
          await assertItCanBeExecuted('2031-02-28T10:32:20Z')
        })
      })

      context('with 3 months frequency', () => {
        const frequency = 3

        it('locks the task properly', async () => {
          // Move to an executable window
          await setInitialTimeLock(mode, frequency, '2032-01-31T10:05:20Z', DAY)
          await moveToDate('2032-01-31T10:05:20Z')

          // It can be executed immediately
          await assertItCanBeExecuted('2032-04-30T10:05:20Z')

          // It is locked for at least the number of set months
          await assertItCannotBeExecuted('2032-04-30T10:05:20Z')
          await moveToDate('2032-02-28T10:05:20Z')
          await assertItCannotBeExecuted('2032-04-30T10:05:20Z')
          await moveToDate('2032-03-31T10:05:20Z')
          await assertItCannotBeExecuted('2032-04-30T10:05:20Z')

          // It cannot be executed after the execution window
          await moveToDate('2032-05-01T10:05:20Z')
          await assertItCannotBeExecuted('2032-04-30T10:05:20Z')

          // It can be executed one period after
          await moveToDate('2032-06-30T10:05:20Z')
          await assertItCanBeExecuted('2032-09-30T10:05:20Z')

          // Change time lock to 24 months
          await setInitialTimeLock(mode, 24, '2033-01-31T05:04:03Z', DAY)
          await assertItCannotBeExecuted('2033-01-31T05:04:03Z')

          // Move to an executable window
          await moveToDate('2033-01-31T05:04:03Z')
          await assertItCanBeExecuted('2035-01-31T05:04:03Z')
        })
      })
    })
  })
})
