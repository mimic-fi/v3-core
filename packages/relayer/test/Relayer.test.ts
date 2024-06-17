import {
  assertEvent,
  assertNoEvent,
  assertNoIndirectEvent,
  decimal,
  deploy,
  deployTokenMock,
  fp,
  getSigner,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  pct,
  ZERO_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { deployEnvironment } from '@mimic-fi/v3-tasks'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'
import { defaultAbiCoder } from 'ethers/lib/utils'
import { ethers } from 'hardhat'

/* eslint-disable no-secrets/no-secrets */

describe('Relayer', () => {
  let relayer: Contract
  let executor: SignerWithAddress, collector: SignerWithAddress, owner: SignerWithAddress

  before('load signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, executor, collector, owner] = await getSigners()
  })

  beforeEach('deploy relayer', async () => {
    relayer = await deploy('Relayer', [executor.address, collector.address, owner.address])
  })

  describe('receive', () => {
    it('reverts', async () => {
      await expect(owner.sendTransaction({ to: relayer.address, value: 1 })).to.be.reverted
    })
  })

  describe('setExecutor', () => {
    context('when the sender is allowed', () => {
      beforeEach('set sender', () => {
        relayer = relayer.connect(owner)
      })

      const itCanBeSet = () => {
        it('can be set', async () => {
          const tx = await relayer.setExecutor(executor.address, true)

          await assertEvent(tx, 'ExecutorSet', { executor, allowed: true })
          expect(await relayer.isExecutorAllowed(executor.address)).to.be.true
        })
      }

      const itCanBeUnset = () => {
        it('can be unset', async () => {
          const tx = await relayer.setExecutor(executor.address, false)

          await assertEvent(tx, 'ExecutorSet', { executor, allowed: false })
          expect(await relayer.isExecutorAllowed(executor.address)).to.be.false
        })
      }

      context('when the executor was not allowed', () => {
        beforeEach('unset executor', async () => {
          await relayer.setExecutor(executor.address, false)
        })

        itCanBeSet()
        itCanBeUnset()
      })

      context('when the executor was allowed', () => {
        beforeEach('set executor', async () => {
          await relayer.setExecutor(executor.address, true)
        })

        itCanBeSet()
        itCanBeUnset()
      })
    })

    context('when the sender is not allowed', () => {
      it('reverts', async () => {
        await expect(relayer.setExecutor(ZERO_ADDRESS, true)).to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })

  describe('setDefaultCollector', () => {
    context('when the sender is allowed', () => {
      beforeEach('set sender', () => {
        relayer = relayer.connect(owner)
      })

      context('when the collector is not zero', () => {
        const collector = '0x0000000000000000000000000000000000000001'

        it('updates the default collector', async () => {
          const tx = await relayer.setDefaultCollector(collector)
          await assertEvent(tx, 'DefaultCollectorSet', { collector })

          expect(await relayer.defaultCollector()).to.be.equal(collector)
          expect(await relayer.getApplicableCollector(owner.address)).to.be.equal(collector)
          expect(await relayer.getSmartVaultCollector(owner.address)).to.be.equal(ZERO_ADDRESS)
        })
      })

      context('when the collector is zero', () => {
        const collector = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(relayer.setDefaultCollector(collector)).to.be.revertedWith('RelayerCollectorZero')
        })
      })
    })

    context('when the sender is not allowed', () => {
      it('reverts', async () => {
        await expect(relayer.setDefaultCollector(ZERO_ADDRESS)).to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })

  describe('setSmartVaultCollector', () => {
    let smartVault: SignerWithAddress

    beforeEach('load smart vault', async () => {
      smartVault = await getSigner()
    })

    context('when the sender is allowed', () => {
      beforeEach('set sender', () => {
        relayer = relayer.connect(owner)
      })

      context('when the collector is not zero', () => {
        const customCollector = '0x0000000000000000000000000000000000000001'

        it('updates the smart vault collector', async () => {
          const tx = await relayer.setSmartVaultCollector(smartVault.address, customCollector)
          await assertEvent(tx, 'SmartVaultCollectorSet', { smartVault, collector: customCollector })

          expect(await relayer.defaultCollector()).to.be.equal(collector.address)
          expect(await relayer.getApplicableCollector(smartVault.address)).to.be.equal(customCollector)
          expect(await relayer.getSmartVaultCollector(smartVault.address)).to.be.equal(customCollector)
        })
      })

      context('when the collector is zero', () => {
        const customCollector = ZERO_ADDRESS

        it('updates the smart vault collector to the default', async () => {
          const tx = await relayer.setSmartVaultCollector(smartVault.address, customCollector)
          await assertEvent(tx, 'SmartVaultCollectorSet', { smartVault, collector: customCollector })

          expect(await relayer.defaultCollector()).to.be.equal(collector.address)
          expect(await relayer.getApplicableCollector(smartVault.address)).to.be.equal(collector.address)
          expect(await relayer.getSmartVaultCollector(smartVault.address)).to.be.equal(customCollector)
        })
      })
    })

    context('when the sender is not allowed', () => {
      it('reverts', async () => {
        await expect(relayer.setSmartVaultCollector(smartVault.address, ZERO_ADDRESS)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        )
      })
    })
  })

  describe('setSmartVaultMaxQuota', () => {
    let smartVault: SignerWithAddress

    beforeEach('load smart vault', async () => {
      smartVault = await getSigner()
    })

    context('when the sender is allowed', () => {
      beforeEach('set sender', () => {
        relayer = relayer.connect(owner)
      })

      context('when the max quota was set', () => {
        const maxQuota = fp(100)

        it('updates the smart vault maximum quota correctly', async () => {
          await relayer.setSmartVaultMaxQuota(smartVault.address, maxQuota)

          expect(await relayer.getSmartVaultMaxQuota(smartVault.address)).to.be.equal(maxQuota)
        })

        it('emits an event', async () => {
          const tx = await relayer.setSmartVaultMaxQuota(smartVault.address, maxQuota)

          await assertEvent(tx, 'SmartVaultMaxQuotaSet', { smartVault, maxQuota })
        })
      })

      context('when the max quota was not set', () => {
        it('returns zero', async () => {
          expect(await relayer.getSmartVaultMaxQuota(smartVault.address)).to.be.equal(0)
        })
      })
    })

    context('when the sender is not allowed', () => {
      it('reverts', async () => {
        await expect(relayer.setSmartVaultMaxQuota(smartVault.address, 0)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        )
      })
    })
  })

  describe('deposit', () => {
    let authorizer: Contract, smartVault: Contract, smartVaultOwner: SignerWithAddress

    beforeEach('deploy smart vault', async () => {
      smartVaultOwner = await getSigner()
      // eslint-disable-next-line prettier/prettier
      ;({ authorizer, smartVault } = await deployEnvironment(smartVaultOwner))
    })

    context('when the used quota is zero', () => {
      const amount = fp(0.1)

      context('when the given value is correct', () => {
        const value = amount

        it('deposits the amount correctly', async () => {
          const previousSmartVaultBalance = await relayer.getSmartVaultBalance(smartVault.address)

          await relayer.deposit(smartVault.address, amount, { value })

          const currentSmartVaultBalance = await relayer.getSmartVaultBalance(smartVault.address)
          expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.add(amount))
        })

        it('increments the relayer balance properly', async () => {
          const previousRelayerBalance = await ethers.provider.getBalance(relayer.address)

          await relayer.deposit(smartVault.address, amount, { value })

          const currentRelayerBalance = await ethers.provider.getBalance(relayer.address)
          expect(currentRelayerBalance).to.be.equal(previousRelayerBalance.add(amount))
        })

        it('emits an event', async () => {
          const tx = await relayer.deposit(smartVault.address, amount, { value })

          await assertEvent(tx, 'Deposited', { smartVault, amount })
        })
      })

      context('when the given value is not correct', () => {
        const value = amount.sub(1)

        it('reverts', async () => {
          await expect(relayer.deposit(smartVault.address, amount, { value })).to.revertedWith(
            'RelayerValueDoesNotMatchAmount'
          )
        })
      })
    })

    context('when the used quota is not zero', () => {
      let amount: BigNumber
      let expectedCurrentQuota: BigNumber, expectedPaidQuota: BigNumber, expectedDepositAmount: BigNumber

      beforeEach('set maximum quota', async () => {
        const maxQuota = fp(10000)
        await relayer.connect(owner).setSmartVaultMaxQuota(smartVault.address, maxQuota)
      })

      beforeEach('use some quota', async () => {
        const task = await deploy('TaskMock', [smartVault.address])

        await authorizer.connect(smartVaultOwner).authorize(task.address, smartVault.address, '0xaabbccdd', [])
        await relayer.deposit(ZERO_ADDRESS, fp(1.5), { value: fp(1.5) })

        const data = task.interface.encodeFunctionData('succeed')
        const tx = await relayer.connect(executor).execute([task.address], [data], false)
        await tx.wait()
      })

      const itDepositsBalanceProperly = () => {
        it('has no balance', async () => {
          expect(await relayer.getSmartVaultBalance(smartVault.address)).to.be.equal(0)
        })

        it('deposits the amount correctly', async () => {
          const previousSmartVaultBalance = fp(0)

          await relayer.deposit(smartVault.address, amount, { value: amount })

          const currentSmartVaultBalance = await relayer.getSmartVaultBalance(smartVault.address)
          expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.add(expectedDepositAmount))
        })

        it('increments the relayer balance properly', async () => {
          const previousRelayerBalance = await ethers.provider.getBalance(relayer.address)

          await relayer.deposit(smartVault.address, amount, { value: amount })

          const currentRelayerBalance = await ethers.provider.getBalance(relayer.address)
          expect(currentRelayerBalance).to.be.equal(previousRelayerBalance.add(expectedDepositAmount))
        })

        it('pays the corresponding quota to the fee collector', async () => {
          const collector = await relayer.getApplicableCollector(smartVault.address)
          const previousCollectorBalance = await ethers.provider.getBalance(collector)

          await relayer.deposit(smartVault.address, amount, { value: amount })

          const currentCollectorBalance = await ethers.provider.getBalance(collector)
          expect(currentCollectorBalance).to.be.equal(previousCollectorBalance.add(expectedPaidQuota))
        })

        it('emits an event', async () => {
          const tx = await relayer.deposit(smartVault.address, amount, { value: amount })

          await assertEvent(tx, 'Deposited', { smartVault, amount: expectedDepositAmount })
        })

        it('decrements the used quota properly', async () => {
          await relayer.deposit(smartVault.address, amount, { value: amount })

          const currentUsedQuota = await relayer.getSmartVaultUsedQuota(smartVault.address)
          expect(currentUsedQuota).to.be.equal(expectedCurrentQuota)
        })

        it('emits an event', async () => {
          const tx = await relayer.deposit(smartVault.address, amount, { value: amount })

          await assertEvent(tx, 'QuotaPaid', { smartVault, amount: expectedPaidQuota })
        })
      }

      context('when the used quota is lower than the amount', () => {
        beforeEach('set data', async () => {
          const usedQuota = await relayer.getSmartVaultUsedQuota(smartVault.address)
          amount = usedQuota.mul(2)

          expectedDepositAmount = amount.sub(usedQuota)
          expectedCurrentQuota = fp(0)
          expectedPaidQuota = usedQuota
        })

        itDepositsBalanceProperly()
      })

      context('when the used quota is greater than or equal to the amount', () => {
        beforeEach('set data', async () => {
          const usedQuota = await relayer.getSmartVaultUsedQuota(smartVault.address)
          amount = usedQuota.div(2)

          expectedDepositAmount = fp(0)
          expectedCurrentQuota = usedQuota.sub(amount)
          expectedPaidQuota = amount
        })

        itDepositsBalanceProperly()
      })
    })
  })

  describe('withdraw', () => {
    let smartVault: SignerWithAddress

    const balance = fp(0.1)

    beforeEach('load smart vault', async () => {
      smartVault = await getSigner()
      await relayer.deposit(smartVault.address, balance, { value: balance })
    })

    context('when the sender has enough balance', () => {
      const amount = balance.div(2)

      it('withdraws the amount correctly', async () => {
        const previousSmartVaultBalance = await relayer.getSmartVaultBalance(smartVault.address)

        await relayer.connect(smartVault).withdraw(amount)

        const currentSmartVaultBalance = await relayer.getSmartVaultBalance(smartVault.address)
        expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.sub(amount))
      })

      it('decrements the relayer balance properly', async () => {
        const previousRelayerBalance = await ethers.provider.getBalance(relayer.address)

        await relayer.connect(smartVault).withdraw(amount)

        const currentRelayerBalance = await ethers.provider.getBalance(relayer.address)
        expect(currentRelayerBalance).to.be.equal(previousRelayerBalance.sub(amount))
      })

      it('increments the smart vault balance properly', async () => {
        const previousSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)

        const tx = await relayer.connect(smartVault).withdraw(amount)
        const { gasUsed, effectiveGasPrice } = await tx.wait()
        const txCost = gasUsed.mul(effectiveGasPrice)

        const currentSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)
        expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.add(amount).sub(txCost))
      })

      it('emits an event', async () => {
        const tx = await relayer.connect(smartVault).withdraw(amount)

        await assertEvent(tx, 'Withdrawn', { smartVault, amount })
      })
    })

    context('when the sender does not have enough balance', () => {
      const amount = balance.add(1)

      it('reverts', async () => {
        await expect(relayer.connect(smartVault).withdraw(amount)).to.revertedWith('RelayerWithdrawInsufficientBalance')
      })
    })
  })

  describe('execute', () => {
    let task: Contract, smartVault: Contract, authorizer: Contract, smartVaultOwner: SignerWithAddress

    beforeEach('deploy smart vault', async () => {
      smartVaultOwner = await getSigner()
      // eslint-disable-next-line prettier/prettier
      ;({ authorizer, smartVault } = await deployEnvironment(smartVaultOwner))
    })

    beforeEach('deploy task', async () => {
      task = await deploy('TaskMock', [smartVault.address])
    })

    context('when the sender is an executor', () => {
      beforeEach('set sender', async () => {
        relayer = relayer.connect(executor)
      })

      context('when the task has permissions over the associated smart vault', () => {
        beforeEach('authorize task', async () => {
          await authorizer.connect(smartVaultOwner).authorize(task.address, smartVault.address, '0xaabbccdd', [])
        })

        context('when the smart vault has enough balance deposited', () => {
          let datas: string[], tasks: string[]

          beforeEach('deposit funds', async () => {
            await relayer.deposit(smartVault.address, fp(0.5), { value: fp(0.5) })
          })

          const itChargesTheExpectedGasAmount = (
            continueIfFail: boolean,
            atLeastOneSucceedTxExecuted: boolean,
            atLeastOneFailedTxExecuted: boolean
          ) => {
            const tolerance = 0.1

            it('charges the expected gas amount', async () => {
              const BASE_GAS = await relayer.BASE_GAS()
              const previousRelayerBalance = await ethers.provider.getBalance(relayer.address)

              const tx = await relayer.execute(tasks, datas, continueIfFail)
              const { gasUsed, effectiveGasPrice } = await tx.wait()

              const currentRelayerBalance = await ethers.provider.getBalance(relayer.address)
              const chargedGasAmount = previousRelayerBalance.sub(currentRelayerBalance)
              const redeemedGas = chargedGasAmount.div(effectiveGasPrice)

              if (atLeastOneSucceedTxExecuted) {
                if (redeemedGas.lt(gasUsed)) {
                  const missing = gasUsed.sub(redeemedGas)
                  if (atLeastOneFailedTxExecuted) {
                    const message = `Relayer paid for ${missing} gas units due to failed txs`
                    console.log(message)
                  } else {
                    const ideal = BASE_GAS.add(missing)
                    const message = `Missing ${missing.toString()} gas units. Set it at least to ${ideal.toString()} gas units.`
                    expect(redeemedGas.toNumber()).to.be.gt(gasUsed.toNumber(), message)
                  }
                } else {
                  const extraGas = redeemedGas.sub(gasUsed)
                  const ratio = decimal(redeemedGas).div(decimal(gasUsed)).toNumber() - 1
                  const message = `Redeemed ${extraGas} extra gas units (+${(ratio * 100).toPrecision(4)} %)`
                  if (ratio <= tolerance) console.log(message)
                  else {
                    const min = gasUsed.sub(redeemedGas.sub(BASE_GAS))
                    const max = pct(gasUsed, 1 + tolerance).sub(redeemedGas.sub(BASE_GAS))
                    expect(ratio).to.be.lte(tolerance, `${message}. Set it between ${min} and ${max}`)
                  }
                }
              } else {
                const extraGas = gasUsed.sub(redeemedGas)
                const message = `Relayer paid for ${extraGas} gas units due to failed txs`
                console.log(message)
              }
            })

            it('transfers the charged gas amount to the expected collector', async () => {
              const collector = await relayer.getApplicableCollector(smartVault.address)
              const previousRelayerBalance = await ethers.provider.getBalance(relayer.address)
              const previousCollectorBalance = await ethers.provider.getBalance(collector)
              const previousSmartVaultBalance = await relayer.getSmartVaultBalance(smartVault.address)

              await relayer.execute(tasks, datas, continueIfFail)

              const currentRelayerBalance = await ethers.provider.getBalance(relayer.address)
              const chargedGasAmount = previousRelayerBalance.sub(currentRelayerBalance)

              const currentCollectorBalance = await ethers.provider.getBalance(collector)
              expect(currentCollectorBalance).to.be.equal(previousCollectorBalance.add(chargedGasAmount))

              const currentSmartVaultBalance = await relayer.getSmartVaultBalance(smartVault.address)
              expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.sub(chargedGasAmount))
            })

            it('withdraws the balance from the smart vault', async () => {
              const previousSmartVaultBalance = await relayer.getSmartVaultBalance(smartVault.address)

              const tx = await relayer.execute(tasks, datas, continueIfFail)

              const currentSmartVaultBalance = await relayer.getSmartVaultBalance(smartVault.address)
              const chargedGasAmount = previousSmartVaultBalance.sub(currentSmartVaultBalance)
              assertEvent(tx, 'GasPaid', { smartVault, amount: chargedGasAmount, quota: 0 })
            })
          }

          context('when the call succeeds', () => {
            let data: string
            const continueIfFail = false
            const atLeastOneSucceedTxExecuted = true
            const atLeastOneFailedTxExecuted = false

            beforeEach('build call data', async () => {
              data = task.interface.encodeFunctionData('succeed')
              datas = [data]
              tasks = [task.address]
            })

            it('logs the transaction properly', async () => {
              const tx = await relayer.execute(tasks, datas, continueIfFail)

              const event = await assertEvent(tx, 'TaskExecuted', { smartVault, task, data, success: true })
              const decodedResult = defaultAbiCoder.decode(['uint256'], event.args.result)[0]
              expect(decodedResult).to.be.equal(1)
            })

            itChargesTheExpectedGasAmount(continueIfFail, atLeastOneSucceedTxExecuted, atLeastOneFailedTxExecuted)
          })

          context('when the call reverts', () => {
            let data: string
            const atLeastOneFailedTxExecuted = true

            beforeEach('build call data', async () => {
              data = task.interface.encodeFunctionData('fail')
            })

            context('when there is only one task to execute', () => {
              const continueIfFail = false
              const atLeastOneSucceedTxExecuted = false

              beforeEach('build execution lists', async () => {
                datas = [data]
                tasks = [task.address]
              })

              it('logs the transaction properly', async () => {
                const tx = await relayer.execute(tasks, datas, continueIfFail)

                const event = await assertEvent(tx, 'TaskExecuted', { smartVault, task, data, success: false })
                const decodedResult = defaultAbiCoder.decode(['string'], `0x${event.args.result.slice(10)}`)[0]
                expect(decodedResult).to.be.equal('TASK_FAILED')
              })

              itChargesTheExpectedGasAmount(continueIfFail, atLeastOneSucceedTxExecuted, atLeastOneFailedTxExecuted)

              it('does not emit a gas paid event', async () => {
                const tx = await relayer.execute(tasks, datas, continueIfFail)

                await assertNoEvent(tx, 'GasPaid')
              })
            })

            context('when there is a second task to execute', () => {
              let secondData: string

              beforeEach('build call data', async () => {
                secondData = task.interface.encodeFunctionData('succeed')
                datas = [data, secondData]
                tasks = [task.address, task.address]
              })

              context('when the execution should continue', () => {
                const continueIfFail = true
                const atLeastOneSucceedTxExecuted = true

                it('logs the transaction properly', async () => {
                  const tx = await relayer.execute(tasks, datas, continueIfFail)

                  const firstEvent = await assertEvent(tx, 'TaskExecuted', { smartVault, task, data, success: false })
                  const firstResult = defaultAbiCoder.decode(['string'], `0x${firstEvent.args.result.slice(10)}`)[0]
                  expect(firstResult).to.be.equal('TASK_FAILED')

                  const secondEvent = await assertEvent(tx, 'TaskExecuted', {
                    smartVault,
                    task,
                    data: secondData,
                    success: true,
                  })
                  const secondResult = defaultAbiCoder.decode(['uint256'], secondEvent.args.result)[0]
                  expect(secondResult).to.be.equal(1)
                })

                itChargesTheExpectedGasAmount(continueIfFail, atLeastOneSucceedTxExecuted, atLeastOneFailedTxExecuted)

                it('emits an event', async () => {
                  const tx = await relayer.execute(tasks, datas, continueIfFail)

                  assertEvent(tx, 'GasPaid')
                })
              })

              context('when the execution should not continue', () => {
                const continueIfFail = false
                const atLeastOneSucceedTxExecuted = false

                it('logs the transaction properly', async () => {
                  const tx = await relayer.execute(tasks, datas, continueIfFail)

                  const firstEvent = await assertEvent(tx, 'TaskExecuted', { smartVault, task, data, success: false })
                  const firstResult = defaultAbiCoder.decode(['string'], `0x${firstEvent.args.result.slice(10)}`)[0]
                  expect(firstResult).to.be.equal('TASK_FAILED')

                  await assertNoIndirectEvent(tx, task.interface, 'Succeeded')
                })

                itChargesTheExpectedGasAmount(continueIfFail, atLeastOneSucceedTxExecuted, atLeastOneFailedTxExecuted)

                it('does not emit a gas paid event', async () => {
                  const tx = await relayer.execute(tasks, datas, continueIfFail)

                  await assertNoEvent(tx, 'GasPaid')
                })
              })
            })
          })
        })

        context('when the smart vault does not have enough balance deposited', () => {
          let data: string

          beforeEach('build call data', async () => {
            data = task.interface.encodeFunctionData('succeed')
          })

          context('when the available quota is enough', () => {
            beforeEach('set maximum quota', async () => {
              const maxQuota = fp(10000)
              await relayer.connect(owner).setSmartVaultMaxQuota(smartVault.address, maxQuota)
            })

            it('withdraws all the balance from the smart vault', async () => {
              await relayer.execute([task.address], [data], false)

              expect(await relayer.getSmartVaultBalance(smartVault.address)).to.be.equal(0)
            })

            it('uses the available quota', async () => {
              const tx = await relayer.execute([task.address], [data], false)
              const event = await assertEvent(tx, 'GasPaid')

              const chargedGasAmount = event.args.quota
              const smartVaultUsedQuota = await relayer.getSmartVaultUsedQuota(smartVault.address)
              expect(smartVaultUsedQuota).to.be.equal(chargedGasAmount)
            })

            it('does not affect the relayer balance', async () => {
              const previousRelayerBalance = await ethers.provider.getBalance(relayer.address)

              await relayer.execute([task.address], [data], false)

              const currentRelayerBalance = await ethers.provider.getBalance(relayer.address)
              expect(currentRelayerBalance).to.be.equal(previousRelayerBalance)
            })

            it('emits an event', async () => {
              const previousQuotaUsed = await relayer.getSmartVaultUsedQuota(smartVault.address)

              const tx = await relayer.execute([task.address], [data], false)

              const currentQuotaUsed = await relayer.getSmartVaultUsedQuota(smartVault.address)
              const expectedQuota = currentQuotaUsed.sub(previousQuotaUsed)
              assertEvent(tx, 'GasPaid', { smartVault, amount: 0, quota: expectedQuota })
            })
          })

          context('when the available quota is not enough', () => {
            it('reverts', async () => {
              await expect(relayer.execute([task.address], [data], false)).to.be.revertedWith(
                'RelayerPaymentInsufficientBalance'
              )
            })
          })
        })
      })

      context('when the task does not have permissions over the associated smart vault', () => {
        it('reverts', async () => {
          await expect(relayer.execute([task.address], ['0x'], false)).to.be.revertedWith(
            'RelayerTaskDoesNotHavePermissions'
          )
        })
      })
    })

    context('when the sender is not an executor', () => {
      it('reverts', async () => {
        await expect(relayer.execute([task.address], ['0x'], false)).to.be.revertedWith('RelayerExecutorNotAllowed')
      })
    })
  })

  describe('simulate', () => {
    let task: Contract, smartVault: Contract, authorizer: Contract, smartVaultOwner: SignerWithAddress

    beforeEach('deploy smart vault', async () => {
      smartVaultOwner = await getSigner()
      // eslint-disable-next-line prettier/prettier
      ;({ authorizer, smartVault } = await deployEnvironment(smartVaultOwner))
    })

    beforeEach('deploy task', async () => {
      task = await deploy('TaskMock', [smartVault.address])
    })

    context('when the sender is an executor', () => {
      beforeEach('set sender', async () => {
        relayer = relayer.connect(executor)
      })

      context('when the task has permissions over the associated smart vault', () => {
        beforeEach('authorize task', async () => {
          await authorizer.connect(smartVaultOwner).authorize(task.address, smartVault.address, '0xaabbccdd', [])
        })

        context('when the smart vault has enough balance deposited', () => {
          let datas: string[], tasks: string[]

          const successList = [true, false]
          const resultList = [
            '0x0000000000000000000000000000000000000000000000000000000000000001',
            '0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000b5441534b5f4641494c4544000000000000000000000000000000000000000000',
          ]

          beforeEach('deposit funds', async () => {
            await relayer.deposit(smartVault.address, fp(0.5), { value: fp(0.5) })
          })

          context('when the call succeeds', () => {
            let data: string
            const continueIfFail = false

            beforeEach('build call data', async () => {
              data = task.interface.encodeFunctionData('succeed')
              datas = [data]
              tasks = [task.address]
            })

            it('reverts properly', async () => {
              await expect(relayer.simulate(tasks, datas, continueIfFail)).to.be.revertedWith(
                `RelayerSimulationResult([[${successList[0]}, "${resultList[0]}"]])`
              )
            })
          })

          context('when the call reverts', () => {
            let data: string

            beforeEach('build call data', async () => {
              data = task.interface.encodeFunctionData('fail')
            })

            context('when there is only one task to execute', () => {
              const continueIfFail = false

              beforeEach('build execution lists', async () => {
                datas = [data]
                tasks = [task.address]
              })

              it('reverts properly', async () => {
                await expect(relayer.simulate(tasks, datas, continueIfFail)).to.be.revertedWith(
                  `RelayerSimulationResult([[${successList[1]}, "${resultList[1]}"]])`
                )
              })
            })

            context('when there is a second task to execute', () => {
              let secondData: string

              beforeEach('build call data', async () => {
                secondData = task.interface.encodeFunctionData('succeed')
                datas = [data, secondData]
                tasks = [task.address, task.address]
              })

              context('when the execution should continue', () => {
                const continueIfFail = true

                it('reverts properly', async () => {
                  await expect(relayer.simulate(tasks, datas, continueIfFail)).to.be.revertedWith(
                    `RelayerSimulationResult([[${successList[1]}, "${resultList[1]}"], [${successList[0]}, "${resultList[0]}"]])`
                  )
                })
              })

              context('when the execution should not continue', () => {
                const continueIfFail = false

                it('reverts properly', async () => {
                  await expect(relayer.simulate(tasks, datas, continueIfFail)).to.be.revertedWith(
                    `RelayerSimulationResult([[${successList[1]}, "${resultList[1]}"], [${successList[1]}, "0x"]])`
                  )
                })
              })
            })
          })
        })

        context('when the smart vault does not have enough balance deposited', () => {
          let data: string

          const success = true
          const result = '0x0000000000000000000000000000000000000000000000000000000000000001'

          beforeEach('build call data', async () => {
            data = task.interface.encodeFunctionData('succeed')
          })

          context('when the available quota is enough', () => {
            beforeEach('set maximum quota', async () => {
              const maxQuota = fp(10000)
              await relayer.connect(owner).setSmartVaultMaxQuota(smartVault.address, maxQuota)
            })

            it('reverts properly', async () => {
              await expect(relayer.simulate([task.address], [data], false)).to.be.revertedWith(
                `RelayerSimulationResult([[${success}, "${result}"]])`
              )
            })
          })

          context('when the available quota is not enough', () => {
            it('reverts', async () => {
              await expect(relayer.simulate([task.address], [data], false)).to.be.revertedWith(
                'RelayerPaymentInsufficientBalance'
              )
            })
          })
        })
      })

      context('when the task does not have permissions over the associated smart vault', () => {
        it('reverts', async () => {
          await expect(relayer.simulate([task.address], ['0x'], false)).to.be.revertedWith(
            'RelayerTaskDoesNotHavePermissions'
          )
        })
      })
    })

    context('when the sender is not an executor', () => {
      it('reverts', async () => {
        await expect(relayer.simulate([task.address], ['0x'], false)).to.be.revertedWith('RelayerExecutorNotAllowed')
      })
    })
  })

  describe('rescueFunds', () => {
    let recipient: SignerWithAddress

    const amount = fp(10)

    before('set recipient', async () => {
      recipient = await getSigner()
    })

    context('when the sender is allowed', () => {
      beforeEach('set sender', () => {
        relayer = relayer.connect(owner)
      })

      context('when the token is not the zero address', () => {
        let token: Contract

        before('deploy token', async () => {
          token = await deployTokenMock('TKN')
        })

        context('when the recipient is not the zero address', () => {
          context('when the amount is greater than zero', () => {
            context('when withdrawing ERC20 tokens', async () => {
              context('when the relayer has enough balance', async () => {
                beforeEach('mint tokens', async () => {
                  await token.mint(relayer.address, amount)
                })

                it('transfers the tokens to the recipient', async () => {
                  const previousRelayerBalance = await token.balanceOf(relayer.address)
                  const previousRecipientBalance = await token.balanceOf(recipient.address)

                  await relayer.rescueFunds(token.address, recipient.address, amount)

                  const currentRelayerBalance = await token.balanceOf(relayer.address)
                  expect(currentRelayerBalance).to.be.equal(previousRelayerBalance.sub(amount))

                  const currentRecipientBalance = await token.balanceOf(recipient.address)
                  expect(currentRecipientBalance).to.be.equal(previousRecipientBalance.add(amount))
                })

                it('emits an event', async () => {
                  const tx = await relayer.rescueFunds(token.address, recipient.address, amount)

                  await assertEvent(tx, 'FundsRescued', {
                    token,
                    amount,
                    recipient,
                  })
                })
              })

              context('when the relayer does not have enough balance', async () => {
                it('reverts', async () => {
                  await expect(relayer.rescueFunds(token.address, recipient.address, amount)).to.be.revertedWith(
                    'ERC20: transfer amount exceeds balance'
                  )
                })
              })
            })

            context('when withdrawing native tokens', () => {
              let token: string, smartVault: SignerWithAddress

              beforeEach('set token address', async () => {
                token = NATIVE_TOKEN_ADDRESS
              })

              beforeEach('load smart vault', async () => {
                smartVault = await getSigner()
              })

              beforeEach('deposit native tokens', async () => {
                const value = amount
                await relayer.deposit(smartVault.address, amount, { value })
              })

              it('reverts', async () => {
                await expect(relayer.rescueFunds(token, recipient.address, amount)).to.be.revertedWith(
                  'Address: call to non-contract'
                )
              })
            })
          })

          context('when the amount is zero', () => {
            const amount = 0

            it('reverts', async () => {
              await expect(relayer.rescueFunds(token.address, recipient.address, amount)).to.be.revertedWith(
                'RelayerAmountZero'
              )
            })
          })
        })

        context('when the recipient is the zero address', () => {
          const recipientAddress = ZERO_ADDRESS

          it('reverts', async () => {
            await expect(relayer.rescueFunds(token.address, recipientAddress, amount)).to.be.revertedWith(
              'RelayerRecipientZero'
            )
          })
        })
      })

      context('when the token is the zero address', () => {
        const tokenAddress = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(relayer.rescueFunds(tokenAddress, recipient.address, amount)).to.be.revertedWith(
            'RelayerTokenZero'
          )
        })
      })
    })

    context('when the sender is not allowed', () => {
      it('reverts', async () => {
        await expect(relayer.rescueFunds(ZERO_ADDRESS, recipient.address, 0)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        )
      })
    })
  })
})
