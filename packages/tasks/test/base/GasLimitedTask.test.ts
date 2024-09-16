import {
  assertEvent,
  deployProxy,
  fp,
  getSigners,
  MAX_UINT256,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from '@mimic-fi/helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { deployEnvironment } from '../../src/setup'

/* eslint-disable no-secrets/no-secrets */

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
            smartVault: smartVault.address,
            previousBalanceConnectorId: ZERO_BYTES32,
            nextBalanceConnectorId: ZERO_BYTES32,
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

  describe('setGasLimits', () => {
    context('when the sender is authorized', async () => {
      beforeEach('authorize sender', async () => {
        const setGasPriceLimitRole = task.interface.getSighash('setGasLimits')
        await authorizer.connect(owner).authorize(owner.address, task.address, setGasPriceLimitRole, [])
        task = task.connect(owner)
      })

      context('when the limit are not zero', async () => {
        const gasPriceLimit = 100e9
        const priorityFeeLimit = 1e5
        const txCostLimit = 1e10
        const txCostLimitPct = fp(0.1)

        it('sets the gas limits', async () => {
          await task.setGasLimits(gasPriceLimit, priorityFeeLimit, txCostLimit, txCostLimitPct)

          const gasLimits = await task.getGasLimits()
          expect(gasLimits.gasPriceLimit).to.be.equal(gasPriceLimit)
          expect(gasLimits.priorityFeeLimit).to.be.equal(priorityFeeLimit)
          expect(gasLimits.txCostLimit).to.be.equal(txCostLimit)
          expect(gasLimits.txCostLimitPct).to.be.equal(txCostLimitPct)
        })

        it('emits an event', async () => {
          const tx = await task.setGasLimits(gasPriceLimit, priorityFeeLimit, txCostLimit, txCostLimitPct)
          await assertEvent(tx, 'GasLimitsSet', { gasPriceLimit, priorityFeeLimit, txCostLimit, txCostLimitPct })
        })
      })

      context('when the gas limits are zero', async () => {
        const gasPriceLimit = 0
        const priorityFeeLimit = 0
        const txCostLimit = 0
        const txCostLimitPct = 0

        it('sets the gas limits', async () => {
          await task.setGasLimits(gasPriceLimit, priorityFeeLimit, txCostLimit, txCostLimitPct)

          const gasLimits = await task.getGasLimits()
          expect(gasLimits.gasPriceLimit).to.be.equal(gasPriceLimit)
          expect(gasLimits.priorityFeeLimit).to.be.equal(priorityFeeLimit)
          expect(gasLimits.txCostLimit).to.be.equal(txCostLimit)
          expect(gasLimits.txCostLimitPct).to.be.equal(txCostLimitPct)
        })

        it('emits an event', async () => {
          const tx = await task.setGasLimits(gasPriceLimit, priorityFeeLimit, txCostLimit, txCostLimitPct)
          await assertEvent(tx, 'GasLimitsSet', { gasPriceLimit, priorityFeeLimit, txCostLimit, txCostLimitPct })
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setGasLimits(0, 0, 0, 0)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('call', () => {
    const gasPriceLimit = 10e9

    beforeEach('authorize sender', async () => {
      const setGasLimitsRole = task.interface.getSighash('setGasLimits')
      await authorizer.connect(owner).authorize(owner.address, task.address, setGasLimitsRole, [])
    })

    context('when the gas price is under the limit', () => {
      const gasPrice = gasPriceLimit - 1

      context('with a tx cost limit', () => {
        context('when the tx consumes less than the cost limit', () => {
          const txCostLimit = MAX_UINT256

          beforeEach('set gas limits', async () => {
            await task.connect(owner).setGasLimits(gasPriceLimit, 0, txCostLimit, 0)
          })

          it('allows executing the task', async () => {
            const tx = await task.call(ZERO_ADDRESS, 0, { gasPrice })
            await assertEvent(tx, 'Executed')
          })
        })

        context('when the tx consumes more than the cost limit', () => {
          const txCostLimit = 1

          beforeEach('set gas limits', async () => {
            await task.connect(owner).setGasLimits(gasPriceLimit, 0, txCostLimit, 0)
          })

          it('reverts', async () => {
            await expect(task.call(ZERO_ADDRESS, 0, { gasPrice })).to.be.revertedWith('TaskTxCostLimitExceeded')
          })
        })
      })

      context('with a tx cost limit pct', () => {
        const txCostLimitPct = fp(0.01)

        beforeEach('set gas limits', async () => {
          await task.connect(owner).setGasLimits(gasPriceLimit, 0, 0, txCostLimitPct)
        })

        context('when the tx moves more than the cost limit percentage', () => {
          it('allows executing the task', async () => {
            const tx = await task.call(NATIVE_TOKEN_ADDRESS, fp(0.1), { gasPrice })
            await assertEvent(tx, 'Executed')
          })
        })

        context('when the tx moves less than the cost limit percentage', () => {
          it('reverts', async () => {
            await expect(task.call(NATIVE_TOKEN_ADDRESS, 1, { gasPrice })).to.be.revertedWith(
              'TaskTxCostLimitPctExceeded'
            )
          })
        })
      })
    })

    context('when the gas price is above the limit', () => {
      const gasPrice = gasPriceLimit + 1

      context('when the tx consumes less than the cost limit', () => {
        const txCostLimit = MAX_UINT256

        beforeEach('set gas limits', async () => {
          await task.connect(owner).setGasLimits(gasPriceLimit, 0, txCostLimit, 0)
        })

        it('reverts', async () => {
          await expect(task.call(ZERO_ADDRESS, 0, { gasPrice })).to.be.revertedWith('TaskGasPriceLimitExceeded')
        })
      })

      context('when the tx consumes more than the cost limit', () => {
        const txCostLimit = 0

        beforeEach('set gas limits', async () => {
          await task.connect(owner).setGasLimits(gasPriceLimit, 0, txCostLimit, 0)
        })

        it('reverts', async () => {
          await expect(task.call(ZERO_ADDRESS, 0, { gasPrice })).to.be.revertedWith('TaskGasPriceLimitExceeded')
        })
      })
    })
  })
})
