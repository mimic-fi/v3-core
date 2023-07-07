import {
  assertEvent,
  deployProxy,
  fp,
  getSigners,
  MAX_UINT256,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { deployEnvironment } from '../../src/setup'

describe('GasLimitedTask', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'GasLimitedTaskMock',
      [],
      [
        {
          baseConfig: {
            owner: owner.address,
            smartVault: smartVault.address,
            tokensSource: smartVault.address,
          },
          gasLimitConfig: {
            txCostLimit: 0,
            txCostLimitPct: 0,
            gasPriceLimit: 0,
            priorityFeeLimit: 0,
          },
        },
      ]
    )
  })

  describe('setGasPriceLimit', () => {
    context('when the sender is authorized', async () => {
      beforeEach('authorize sender', async () => {
        const setGasPriceLimitRole = task.interface.getSighash('setGasPriceLimit')
        await authorizer.connect(owner).authorize(owner.address, task.address, setGasPriceLimitRole, [])
        task = task.connect(owner)
      })

      context('when the gas price limit is not zero', async () => {
        const gasPriceLimit = 100e9

        it('sets the gas price limit', async () => {
          await task.setGasPriceLimit(gasPriceLimit)
          expect(await task.gasPriceLimit()).to.be.equal(gasPriceLimit)
        })

        it('emits an event', async () => {
          const tx = await task.setGasPriceLimit(gasPriceLimit)
          await assertEvent(tx, 'GasPriceLimitSet', { gasPriceLimit })
        })
      })

      context('when the gas price limit is zero', async () => {
        const gasPriceLimit = 0

        it('sets the gas price limit', async () => {
          await task.setGasPriceLimit(gasPriceLimit)
          expect(await task.gasPriceLimit()).to.be.equal(gasPriceLimit)
        })

        it('emits an event', async () => {
          const tx = await task.setGasPriceLimit(gasPriceLimit)
          await assertEvent(tx, 'GasPriceLimitSet', { gasPriceLimit })
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setGasPriceLimit(0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setPriorityFeeLimit', () => {
    context('when the sender is authorized', async () => {
      beforeEach('authorize sender', async () => {
        const setPriorityFeeLimitRole = task.interface.getSighash('setPriorityFeeLimit')
        await authorizer.connect(owner).authorize(owner.address, task.address, setPriorityFeeLimitRole, [])
        task = task.connect(owner)
      })

      context('when the gas price limit is not zero', async () => {
        const priorityFeeLimit = 100e9

        it('sets the priority fee limit', async () => {
          await task.setPriorityFeeLimit(priorityFeeLimit)
          expect(await task.priorityFeeLimit()).to.be.equal(priorityFeeLimit)
        })

        it('emits an event', async () => {
          const tx = await task.setPriorityFeeLimit(priorityFeeLimit)
          await assertEvent(tx, 'PriorityFeeLimitSet', { priorityFeeLimit })
        })
      })

      context('when the gas price limit is zero', async () => {
        const priorityFeeLimit = 0

        it('sets the priority fee limit', async () => {
          await task.setPriorityFeeLimit(priorityFeeLimit)
          expect(await task.priorityFeeLimit()).to.be.equal(priorityFeeLimit)
        })

        it('emits an event', async () => {
          const tx = await task.setPriorityFeeLimit(priorityFeeLimit)
          await assertEvent(tx, 'PriorityFeeLimitSet', { priorityFeeLimit })
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setPriorityFeeLimit(0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setTxCostLimit', () => {
    context('when the sender is allowed', () => {
      beforeEach('authorize sender', async () => {
        const setTxCostLimitRole = task.interface.getSighash('setTxCostLimit')
        await authorizer.connect(owner).authorize(owner.address, task.address, setTxCostLimitRole, [])
        task = task.connect(owner)
      })

      context('when the limit is not zero', () => {
        const txCostLimit = 100e9

        it('sets the tx cost limit', async () => {
          await task.setTxCostLimit(txCostLimit)
          expect(await task.txCostLimit()).to.be.equal(txCostLimit)
        })

        it('emits an event', async () => {
          const tx = await task.setTxCostLimit(txCostLimit)
          await assertEvent(tx, 'TxCostLimitSet', { txCostLimit })
        })
      })

      context('when the limit is zero', () => {
        const txCostLimit = 0

        it('sets the tx cost limit', async () => {
          await task.setTxCostLimit(txCostLimit)
          expect(await task.txCostLimit()).to.be.equal(txCostLimit)
        })

        it('emits an event', async () => {
          const tx = await task.setTxCostLimit(txCostLimit)
          await assertEvent(tx, 'TxCostLimitSet', { txCostLimit })
        })
      })
    })

    context('when the sender is not allowed', () => {
      it('reverts', async () => {
        await expect(task.setTxCostLimit(0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setTxCostLimitPct', () => {
    context('when the sender is allowed', () => {
      beforeEach('authorize sender', async () => {
        const setTxCostLimitPctRole = task.interface.getSighash('setTxCostLimitPct')
        await authorizer.connect(owner).authorize(owner.address, task.address, setTxCostLimitPctRole, [])
        task = task.connect(owner)
      })

      context('when the limit is below one', () => {
        const itSetsTxCostLimitPctCorrectly = (txCostLimitPct) => {
          it('sets the tx cost limit', async () => {
            await task.setTxCostLimitPct(txCostLimitPct)
            expect(await task.txCostLimitPct()).to.be.equal(txCostLimitPct)
          })

          it('emits an event', async () => {
            const tx = await task.setTxCostLimitPct(txCostLimitPct)
            await assertEvent(tx, 'TxCostLimitPctSet', { txCostLimitPct })
          })
        }

        context('when the limit is zero', () => {
          const txCostLimitPct = 0

          itSetsTxCostLimitPctCorrectly(txCostLimitPct)
        })

        context('when the limit is not zero', () => {
          const txCostLimitPct = fp(0.1)

          itSetsTxCostLimitPctCorrectly(txCostLimitPct)
        })
      })

      context('when the limit is above one', () => {
        const txCostLimitPct = fp(1.1)

        it('reverts', async () => {
          await expect(task.setTxCostLimitPct(txCostLimitPct)).to.be.revertedWith('TASK_TX_COST_LIMIT_PCT_ABOVE_ONE')
        })
      })
    })

    context('when the sender is not allowed', () => {
      it('reverts', async () => {
        await expect(task.setTxCostLimitPct(0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    const gasPriceLimit = 10e9

    beforeEach('set gas price limit', async () => {
      const setGasPriceLimitRole = task.interface.getSighash('setGasPriceLimit')
      await authorizer.connect(owner).authorize(owner.address, task.address, setGasPriceLimitRole, [])
      await task.connect(owner).setGasPriceLimit(gasPriceLimit)
    })

    context('when the gas price is under the limit', () => {
      const gasPrice = gasPriceLimit - 1

      context('with a tx cost limit', () => {
        context('when the tx consumes less than the cost limit', () => {
          const txCostLimit = MAX_UINT256

          beforeEach('set tx cost limit', async () => {
            const setTxCostLimitRole = task.interface.getSighash('setTxCostLimit')
            await authorizer.connect(owner).authorize(owner.address, task.address, setTxCostLimitRole, [])
            await task.connect(owner).setTxCostLimit(txCostLimit)
          })

          it('allows executing the task', async () => {
            const tx = await task.call(ZERO_ADDRESS, 0, { gasPrice })
            await assertEvent(tx, 'Executed')
          })
        })

        context('when the tx consumes more than the cost limit', () => {
          const txCostLimit = 1

          beforeEach('set tx cost limit', async () => {
            const setTxCostLimitRole = task.interface.getSighash('setTxCostLimit')
            await authorizer.connect(owner).authorize(owner.address, task.address, setTxCostLimitRole, [])
            await task.connect(owner).setTxCostLimit(txCostLimit)
          })

          it('reverts', async () => {
            await expect(task.call(ZERO_ADDRESS, 0, { gasPrice })).to.be.revertedWith('TASK_TX_COST_LIMIT')
          })
        })
      })

      context('with a tx cost limit pct', () => {
        const txCostLimitPct = fp(0.01)

        beforeEach('set tx cost limit pct', async () => {
          const setTxCostLimitPctRole = task.interface.getSighash('setTxCostLimitPct')
          await authorizer.connect(owner).authorize(owner.address, task.address, setTxCostLimitPctRole, [])
          await task.connect(owner).setTxCostLimitPct(txCostLimitPct)
        })

        context('when the tx moves more than the cost limit percentage', () => {
          it('allows executing the task', async () => {
            const tx = await task.call(NATIVE_TOKEN_ADDRESS, fp(0.1), { gasPrice })
            await assertEvent(tx, 'Executed')
          })
        })

        context('when the tx moves less than the cost limit percentage', () => {
          it('reverts', async () => {
            await expect(task.call(NATIVE_TOKEN_ADDRESS, 1, { gasPrice })).to.be.revertedWith('TASK_TX_COST_LIMIT_PCT')
          })
        })
      })
    })

    context('when the gas price is above the limit', () => {
      const gasPrice = gasPriceLimit + 1

      context('when the tx consumes less than the cost limit', () => {
        const txCostLimit = MAX_UINT256

        beforeEach('set tx cost limit', async () => {
          const setTxCostLimitRole = task.interface.getSighash('setTxCostLimit')
          await authorizer.connect(owner).authorize(owner.address, task.address, setTxCostLimitRole, [])
          await task.connect(owner).setTxCostLimit(txCostLimit)
        })

        it('reverts', async () => {
          await expect(task.call(ZERO_ADDRESS, 0, { gasPrice })).to.be.revertedWith('TASK_GAS_PRICE_LIMIT')
        })
      })

      context('when the tx consumes more than the cost limit', () => {
        const txCostLimit = 0

        beforeEach('set tx cost limit', async () => {
          const setTxCostLimitRole = task.interface.getSighash('setTxCostLimit')
          await authorizer.connect(owner).authorize(owner.address, task.address, setTxCostLimitRole, [])
          await task.connect(owner).setTxCostLimit(txCostLimit)
        })

        it('reverts', async () => {
          await expect(task.call(ZERO_ADDRESS, 0, { gasPrice })).to.be.revertedWith('TASK_GAS_PRICE_LIMIT')
        })
      })
    })
  })
})
