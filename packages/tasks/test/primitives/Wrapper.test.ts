import {
  assertEvent,
  assertIndirectEvent,
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

describe('Wrapper', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, mimic: Mimic, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault, mimic } = await deployEnvironment(owner))
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'Wrapper',
      [],
      [
        {
          taskConfig: buildEmptyTaskConfig(owner, smartVault),
        },
      ]
    )
  })

  describe('execution type', () => {
    it('defines it correctly', async () => {
      const expectedType = ethers.utils.solidityKeccak256(['string'], ['WRAPPER'])
      expect(await task.EXECUTION_TYPE()).to.be.equal(expectedType)
    })
  })

  describe('call', () => {
    beforeEach('authorize task', async () => {
      const wrapRole = smartVault.interface.getSighash('wrap')
      await authorizer.connect(owner).authorize(task.address, smartVault.address, wrapRole, [])
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = task.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, task.address, callRole, [])
        task = task.connect(owner)
      })

      context('when the given token is the native token', () => {
        const token = NATIVE_TOKEN_ADDRESS

        context('when the given amount is greater than zero', () => {
          const amount = fp(0.02)

          beforeEach('fund smart vault', async () => {
            await owner.sendTransaction({ to: smartVault.address, value: amount })
          })

          context('when the threshold has passed', () => {
            const threshold = amount

            beforeEach('set default token threshold', async () => {
              const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
              await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
              await task.connect(owner).setDefaultTokenThreshold(mimic.wrappedNativeToken.address, threshold, 0)
            })

            it('calls the wrap primitive', async () => {
              const tx = await task.call(token, amount)
              await assertIndirectEvent(tx, smartVault.interface, 'Wrapped', { amount })
            })

            it('emits an Executed event', async () => {
              const tx = await task.call(token, amount)
              await assertEvent(tx, 'Executed')
            })

            it('updates the balance connectors properly', async () => {
              const nextConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000002'
              const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
              await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
              await task.connect(owner).setBalanceConnectors(ZERO_BYTES32, nextConnectorId)

              const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
              await authorizer
                .connect(owner)
                .authorize(task.address, smartVault.address, updateBalanceConnectorRole, [])

              const tx = await task.call(token, amount)

              await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
                id: nextConnectorId,
                token: mimic.wrappedNativeToken.address,
                amount,
                added: true,
              })
            })
          })

          context('when the threshold has not passed', () => {
            const threshold = amount.add(1)

            beforeEach('set default token threshold', async () => {
              const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
              await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
              await task.connect(owner).setDefaultTokenThreshold(mimic.wrappedNativeToken.address, threshold, 0)
            })

            it('reverts', async () => {
              await expect(task.call(token, amount)).to.be.revertedWith('TASK_TOKEN_THRESHOLD_NOT_MET')
            })
          })
        })

        context('when the given amount is zero', () => {
          const amount = 0

          it('reverts', async () => {
            await expect(task.call(token, amount)).to.be.revertedWith('TASK_AMOUNT_ZERO')
          })
        })
      })

      context('when the given token is not the native token', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.call(token, 0)).to.be.revertedWith('TASK_TOKEN_NOT_NATIVE')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(ZERO_ADDRESS, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
