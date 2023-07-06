import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  deployProxy,
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

import { buildEmptyTaskConfig, deployEnvironment, Mimic } from '../../src/setup'

describe('Withdrawer', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, mimic: Mimic, owner: SignerWithAddress, recipient: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner, recipient] = await getSigners())
    ;({ authorizer, smartVault, mimic } = await deployEnvironment(owner))
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'Withdrawer',
      [],
      [
        {
          recipient: recipient.address,
          taskConfig: buildEmptyTaskConfig(owner, smartVault),
        },
      ]
    )
  })

  describe('execution type', () => {
    it('defines it correctly', async () => {
      const expectedType = ethers.utils.solidityKeccak256(['string'], ['WITHDRAWER'])
      expect(await task.EXECUTION_TYPE()).to.be.equal(expectedType)
    })
  })

  describe('setBalanceConnectors', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
        await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
        task = task.connect(owner)
      })

      const itCanBeSet = (previous: string, next: string) => {
        it('can be set', async () => {
          const tx = await task.setBalanceConnectors(previous, next)

          expect(await task.previousBalanceConnectorId()).to.be.equal(previous)
          expect(await task.nextBalanceConnectorId()).to.be.equal(next)

          await assertEvent(tx, 'BalanceConnectorsSet', { previous, next })
        })
      }

      context('when setting to non-zero', () => {
        const previous = '0x0000000000000000000000000000000000000000000000000000000000000001'

        context('when setting next to zero', () => {
          const next = ZERO_BYTES32

          itCanBeSet(previous, next)
        })

        context('when setting next to non-zero', () => {
          const next = '0x0000000000000000000000000000000000000000000000000000000000000002'

          it('reverts', async () => {
            await expect(task.setBalanceConnectors(previous, next)).to.be.revertedWith('TASK_NEXT_CONNECTOR_NOT_ZERO')
          })
        })
      })

      context('when setting to zero', () => {
        const previous = ZERO_BYTES32
        const next = ZERO_BYTES32

        itCanBeSet(previous, next)
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setBalanceConnectors(ZERO_BYTES32, ZERO_BYTES32)).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })

  describe('setRecipient', () => {
    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setRecipientRole = task.interface.getSighash('setRecipient')
        await authorizer.connect(owner).authorize(owner.address, task.address, setRecipientRole, [])
        task = task.connect(owner)
      })

      context('when the new address is not zero', async () => {
        context('when the new address is not the smart vault', async () => {
          let newRecipient: SignerWithAddress

          beforeEach('set new recipient', async () => {
            newRecipient = recipient
          })

          it('sets the recipient', async () => {
            await task.setRecipient(newRecipient.address)
            expect(await task.recipient()).to.be.equal(newRecipient.address)
          })

          it('emits an event', async () => {
            const tx = await task.setRecipient(newRecipient.address)
            await assertEvent(tx, 'RecipientSet', { recipient: newRecipient })
          })
        })

        context('when the new address is the smart vault', async () => {
          let newRecipient: string

          beforeEach('set new recipient', async () => {
            newRecipient = smartVault.address
          })

          it('reverts', async () => {
            await expect(task.setRecipient(newRecipient)).to.be.revertedWith('TASK_RECIPIENT_SMART_VAULT')
          })
        })
      })

      context('when the new address is zero', async () => {
        const newRecipient = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.setRecipient(newRecipient)).to.be.revertedWith('TASK_RECIPIENT_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setRecipient(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    let token: Contract

    const threshold = fp(2)

    beforeEach('set token and recipient', async () => {
      token = await deploy('TokenMock', ['USDC'])
    })

    beforeEach('authorize task', async () => {
      const withdrawRole = smartVault.interface.getSighash('withdraw')
      await authorizer.connect(owner).authorize(task.address, smartVault.address, withdrawRole, [])
    })

    beforeEach('set recipient', async () => {
      const setRecipientRole = task.interface.getSighash('setRecipient')
      await authorizer.connect(owner).authorize(owner.address, task.address, setRecipientRole, [])
      await task.connect(owner).setRecipient(recipient.address)
    })

    beforeEach('set tokens acceptance type', async () => {
      const setTokensAcceptanceTypeRole = task.interface.getSighash('setTokensAcceptanceType')
      await authorizer.connect(owner).authorize(owner.address, task.address, setTokensAcceptanceTypeRole, [])
      await task.connect(owner).setTokensAcceptanceType(1)
    })

    beforeEach('set tokens acceptance list', async () => {
      const setTokensAcceptanceListRole = task.interface.getSighash('setTokensAcceptanceList')
      await authorizer.connect(owner).authorize(owner.address, task.address, setTokensAcceptanceListRole, [])
      await task.connect(owner).setTokensAcceptanceList([token.address], [true])
    })

    beforeEach('set default token threshold', async () => {
      const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
      await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
      await task.connect(owner).setDefaultTokenThreshold({ token: token.address, min: threshold, max: 0 })
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = task.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, task.address, callRole, [])
        task = task.connect(owner)
      })

      context('when the given token is allowed', () => {
        context('when the threshold has passed', () => {
          const amount = threshold

          beforeEach('fund smart vault', async () => {
            await token.mint(smartVault.address, amount)
          })

          it('calls the withdraw primitive', async () => {
            const previousFeeCollectorBalance = await token.balanceOf(mimic.feeCollector.address)

            const tx = await task.call(token.address, amount)

            const currentFeeCollectorBalance = await token.balanceOf(mimic.feeCollector.address)
            const chargedFees = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)

            await assertIndirectEvent(tx, smartVault.interface, 'Withdrawn', {
              token,
              recipient,
              amount: amount.sub(chargedFees),
              fee: chargedFees,
            })
          })

          it('emits an Executed event', async () => {
            const tx = await task.call(token.address, amount)

            await assertEvent(tx, 'Executed')
          })
        })

        context('when the threshold has not passed', () => {
          const amount = threshold.sub(1)

          beforeEach('fund smart vault', async () => {
            await token.mint(smartVault.address, amount)
          })

          it('reverts', async () => {
            await expect(task.call(token.address, amount)).to.be.revertedWith('TASK_TOKEN_THRESHOLD_NOT_MET')
          })
        })
      })

      context('when the given token is not allowed', () => {
        it('reverts', async () => {
          await expect(task.call(NATIVE_TOKEN_ADDRESS, 0)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(token.address, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
