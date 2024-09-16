import { assertEvent, deployProxy, fp, getSigners, NATIVE_TOKEN_ADDRESS, ZERO_BYTES32 } from '@mimic-fi/helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { deployEnvironment } from '../../src/setup'

describe('PausableTask', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'PausableTaskMock',
      [],
      [
        {
          baseConfig: {
            smartVault: smartVault.address,
            previousBalanceConnectorId: ZERO_BYTES32,
            nextBalanceConnectorId: ZERO_BYTES32,
          },
        },
      ]
    )
  })

  describe('pause', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const pauseRole = task.interface.getSighash('pause')
        await authorizer.connect(owner).authorize(owner.address, task.address, pauseRole, [])
        task = task.connect(owner)
      })

      context('when the task is not paused', () => {
        it('can be paused', async () => {
          const tx = await task.pause()

          expect(await task.isPaused()).to.be.true

          await assertEvent(tx, 'Paused')
        })
      })

      context('when the task is paused', () => {
        beforeEach('pause', async () => {
          await task.pause()
        })

        it('cannot be paused', async () => {
          await expect(task.pause()).to.be.revertedWith('TaskPaused')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.pause()).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('unpause', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const unpauseRole = task.interface.getSighash('unpause')
        await authorizer.connect(owner).authorize(owner.address, task.address, unpauseRole, [])
        task = task.connect(owner)
      })

      context('when the task is not paused', () => {
        it('cannot be unpaused', async () => {
          await expect(task.unpause()).to.be.revertedWith('TaskUnpaused')
        })
      })

      context('when the task is paused', () => {
        beforeEach('pause', async () => {
          const pauseRole = task.interface.getSighash('pause')
          await authorizer.connect(owner).authorize(owner.address, task.address, pauseRole, [])
          await task.connect(owner).pause()
        })

        it('can be unpaused', async () => {
          const tx = await task.unpause()

          expect(await task.isPaused()).to.be.false

          await assertEvent(tx, 'Unpaused')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.unpause()).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('call', () => {
    const token = NATIVE_TOKEN_ADDRESS
    const amount = fp(0.01)

    context('when the task is not paused', () => {
      it('can be executed', async () => {
        const tx = await task.call(token, amount)
        await assertEvent(tx, 'Executed')
      })
    })

    context('when the task is paused', () => {
      beforeEach('pause', async () => {
        const pauseRole = smartVault.interface.getSighash('pause')
        await authorizer.connect(owner).authorize(owner.address, task.address, pauseRole, [])
        await task.connect(owner).pause()
      })

      it('cannot be executed', async () => {
        await expect(task.call(token, amount)).to.be.revertedWith('TaskPaused')
      })
    })
  })
})
