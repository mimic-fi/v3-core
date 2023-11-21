import {
  assertEvent,
  assertIndirectEvent,
  assertNoEvent,
  assertNoIndirectEvent,
  BigNumberish,
  deployProxy,
  deployTokenMock,
  fp,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

import { buildEmptyTaskConfig, deployEnvironment } from '../../src/setup'

describe('Depositor', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy('Depositor', [], [{ taskConfig: buildEmptyTaskConfig(owner, smartVault) }])
  })

  describe('execution type', () => {
    it('defines it correctly', async () => {
      const expectedType = ethers.utils.solidityKeccak256(['string'], ['DEPOSITOR'])
      expect(await task.EXECUTION_TYPE()).to.be.equal(expectedType)
    })
  })

  describe('receive', () => {
    context('when sending some value', () => {
      const value = 1

      it('accepts native tokens', async () => {
        await owner.sendTransaction({ to: task.address, value })

        expect(await ethers.provider.getBalance(task.address)).to.be.equal(1)
      })
    })

    context('when sending no value', () => {
      const value = 0

      it('reverts', async () => {
        await expect(owner.sendTransaction({ to: task.address, value })).to.be.revertedWith('TaskValueZero')
      })
    })
  })

  describe('call', () => {
    beforeEach('authorize task', async () => {
      const collectRole = smartVault.interface.getSighash('collect')
      await authorizer.connect(owner).authorize(task.address, smartVault.address, collectRole, [])
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = task.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, task.address, callRole, [])
        task = task.connect(owner)
      })

      context('when the token is not zero', () => {
        context('when the token is an ERC20', () => {
          let token: Contract

          beforeEach('set token', async () => {
            token = await deployTokenMock('USDC')
          })

          context('when the amount is not zero', () => {
            const amount = fp(5)

            beforeEach('fund task', async () => {
              await token.mint(task.address, amount)
            })

            const itExecutesTheTaskProperly = (requestedAmount: BigNumberish) => {
              it('calls the collect primitive', async () => {
                const tx = await task.call(token.address, requestedAmount)

                await assertIndirectEvent(tx, smartVault.interface, 'Collected', { token, from: task, amount })
              })

              it('emits an Executed event', async () => {
                const tx = await task.call(token.address, requestedAmount)

                await assertEvent(tx, 'Executed')
              })
            }

            context('without balance connectors', () => {
              const requestedAmount = amount

              itExecutesTheTaskProperly(requestedAmount)

              it('does not update any balance connectors', async () => {
                const tx = await task.call(token.address, requestedAmount)

                await assertNoEvent(tx, 'BalanceConnectorUpdated')
              })
            })

            context('with balance connectors', () => {
              const requestedAmount = 0
              const nextConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000002'

              beforeEach('set balance connectors', async () => {
                const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
                await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
                await task.connect(owner).setBalanceConnectors(ZERO_BYTES32, nextConnectorId)
              })

              beforeEach('authorize task to update balance connectors', async () => {
                const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
                await authorizer
                  .connect(owner)
                  .authorize(task.address, smartVault.address, updateBalanceConnectorRole, [])
              })

              itExecutesTheTaskProperly(requestedAmount)

              it('updates the balance connectors properly', async () => {
                const tx = await task.call(token.address, requestedAmount)

                await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
                  id: nextConnectorId,
                  token,
                  amount,
                  added: true,
                })
              })
            })
          })

          context('when the amount is zero', () => {
            const amount = 0

            it('reverts', async () => {
              await expect(task.call(token.address, amount)).to.be.revertedWith('TaskAmountZero')
            })
          })
        })

        context('when the token is the native token', () => {
          const token = NATIVE_TOKEN_ADDRESS

          context('when the amount is not zero', () => {
            const amount = fp(2)

            beforeEach('fund task', async () => {
              await owner.sendTransaction({ to: task.address, value: amount })
            })

            const itExecutesTheTaskProperly = (requestedAmount: BigNumberish) => {
              it('does not call the collect primitive', async () => {
                const tx = await task.call(token, requestedAmount)

                await assertNoIndirectEvent(tx, smartVault.interface, 'Collected')
              })

              it('sends the amount to the smart vault', async () => {
                const previousTaskBalance = await ethers.provider.getBalance(task.address)
                const previousSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)

                await task.call(token, requestedAmount)

                const currentTaskBalance = await ethers.provider.getBalance(task.address)
                expect(currentTaskBalance).to.be.equal(previousTaskBalance.sub(amount))

                const currentSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)
                expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.add(amount))
              })

              it('emits an Executed event', async () => {
                const tx = await task.call(token, requestedAmount)

                await assertEvent(tx, 'Executed')
              })
            }

            context('without balance connectors', () => {
              const requestedAmount = amount

              itExecutesTheTaskProperly(requestedAmount)

              it('does not update any balance connectors', async () => {
                const tx = await task.call(token, requestedAmount)

                await assertNoEvent(tx, 'BalanceConnectorUpdated')
              })
            })

            context('with balance connectors', () => {
              const requestedAmount = 0
              const nextConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000002'

              beforeEach('set balance connectors', async () => {
                const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
                await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
                await task.connect(owner).setBalanceConnectors(ZERO_BYTES32, nextConnectorId)
              })

              beforeEach('authorize task to update balance connectors', async () => {
                const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
                await authorizer
                  .connect(owner)
                  .authorize(task.address, smartVault.address, updateBalanceConnectorRole, [])
              })

              itExecutesTheTaskProperly(requestedAmount)

              it('updates the balance connectors properly', async () => {
                const tx = await task.call(token, requestedAmount)

                await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
                  id: nextConnectorId,
                  token,
                  amount,
                  added: true,
                })
              })
            })
          })

          context('when the amount is zero', () => {
            const amount = 0

            it('reverts', async () => {
              await expect(task.call(token, amount)).to.be.revertedWith('TaskAmountZero')
            })
          })
        })
      })

      context('when the token is zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.call(token, 1)).to.be.revertedWith('TaskTokenZero')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(ZERO_ADDRESS, 0)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })
})
