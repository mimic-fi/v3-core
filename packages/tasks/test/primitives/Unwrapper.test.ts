import { assertEvent, assertIndirectEvent, deployProxy, fp, getSigners } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment, Mimic } from '../../src/setup'

describe('Unwrapper', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, mimic: Mimic, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault, mimic } = await deployEnvironment(owner))
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'Unwrapper',
      [],
      [
        {
          taskConfig: buildEmptyTaskConfig(owner, smartVault),
        },
      ]
    )
  })

  describe('call', () => {
    const threshold = fp(0.2)

    beforeEach('authorize task', async () => {
      const unwrapRole = smartVault.interface.getSighash('unwrap')
      await authorizer.connect(owner).authorize(task.address, smartVault.address, unwrapRole, [])
    })

    beforeEach('set default token threshold', async () => {
      const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
      await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
      await task
        .connect(owner)
        .setDefaultTokenThreshold({ token: mimic.wrappedNativeToken.address, min: threshold, max: 0 })
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = task.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, task.address, callRole, [])
        task = task.connect(owner)
      })

      context('when the threshold has passed', () => {
        const amount = threshold

        beforeEach('fund smart vault', async () => {
          await mimic.wrappedNativeToken.connect(owner).deposit({ value: amount })
          await mimic.wrappedNativeToken.connect(owner).transfer(smartVault.address, amount)
        })

        it('calls the unwrap primitive', async () => {
          const tx = await task.call(amount)
          await assertIndirectEvent(tx, smartVault.interface, 'Unwrapped', { amount })
        })

        it('emits an Executed event', async () => {
          const tx = await task.call(amount)
          await assertEvent(tx, 'Executed')
        })
      })

      context('when the threshold has not passed', () => {
        const amount = threshold.sub(1)

        beforeEach('fund smart vault', async () => {
          await owner.sendTransaction({ to: smartVault.address, value: amount })
        })

        it('reverts', async () => {
          await expect(task.call(amount)).to.be.revertedWith('TASK_TOKEN_THRESHOLD_NOT_MET')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
