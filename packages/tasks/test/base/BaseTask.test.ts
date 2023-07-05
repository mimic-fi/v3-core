import {
  assertEvent,
  deploy,
  deployProxy,
  fp,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ONES_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { deployEnvironment } from '../../src/setup'

describe('BaseTask', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'BaseTaskMock',
      [],
      [{ groupId: 0, tokensSource: smartVault.address, smartVault: smartVault.address }]
    )
  })

  describe('initialization', async () => {
    it('cannot be initialized twice', async () => {
      await expect(
        task.initialize({ groupId: 0, tokensSource: smartVault.address, smartVault: smartVault.address })
      ).to.be.revertedWith('Initializable: contract is already initialized')
    })
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
          await expect(task.pause()).to.be.revertedWith('TASK_ALREADY_PAUSED')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.pause()).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
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
          await expect(task.unpause()).to.be.revertedWith('TASK_ALREADY_UNPAUSED')
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
        await expect(task.unpause()).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('transferToSmartVault', () => {
    const balance = fp(1)

    context('when the sender has permissions', async () => {
      beforeEach('authorize sender', async () => {
        const transferToSmartVaultRole = task.interface.getSighash('transferToSmartVault')
        await authorizer.connect(owner).authorize(owner.address, task.address, transferToSmartVaultRole, [])
        task = task.connect(owner)
      })

      context('when the token is ETH', () => {
        const token = NATIVE_TOKEN_ADDRESS

        beforeEach('fund task', async () => {
          await owner.sendTransaction({ to: task.address, value: balance })
        })

        it('transfers it to smart vault', async () => {
          const previousTaskBalance = await task.getTaskBalance(token)
          const previousSmartVaultBalance = await task.getSmartVaultBalance(token)

          await task.transferToSmartVault(token, balance)

          const currentTaskBalance = await task.getTaskBalance(token)
          expect(currentTaskBalance).to.be.equal(previousTaskBalance.sub(balance))

          const currentSmartVaultBalance = await task.getSmartVaultBalance(token)
          expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.add(balance))

          const taskAmount = await task.getTaskAmount(token)
          expect(taskAmount).to.be.equal(currentSmartVaultBalance)
        })
      })

      context('when the token is an ERC20', () => {
        let token: Contract

        beforeEach('fund task', async () => {
          token = await deploy('TokenMock', ['USDC'])
          await token.mint(task.address, balance)
        })

        it('transfers it to smart vault', async () => {
          const previousTaskBalance = await task.getTaskBalance(token.address)
          const previousSmartVaultBalance = await task.getSmartVaultBalance(token.address)

          await task.transferToSmartVault(token.address, balance)

          const currentTaskBalance = await task.getTaskBalance(token.address)
          expect(currentTaskBalance).to.be.equal(previousTaskBalance.sub(balance))

          const currentSmartVaultBalance = await task.getSmartVaultBalance(token.address)
          expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.add(balance))

          const taskAmount = await task.getTaskAmount(token.address)
          expect(taskAmount).to.be.equal(currentSmartVaultBalance)
        })
      })
    })

    context('when the sender does not have permissions', async () => {
      it('reverts', async () => {
        await expect(task.transferToSmartVault(NATIVE_TOKEN_ADDRESS, balance)).to.be.revertedWith('SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setGroupId', () => {
    const groupId = 1

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setGroupIdRole = task.interface.getSighash('setGroupId')
        await authorizer.connect(owner).authorize(owner.address, task.address, setGroupIdRole, [])
        task = task.connect(owner)
      })

      it('can be set', async () => {
        const tx = await task.setGroupId(groupId)

        expect(await task.groupId()).to.be.equal(groupId)

        await assertEvent(tx, 'GroupIdSet', { groupId })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setGroupId(groupId)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setTokensSource', () => {
    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setTokensSourceRole = task.interface.getSighash('setTokensSource')
        await authorizer.connect(owner).authorize(owner.address, task.address, setTokensSourceRole, [])
        task = task.connect(owner)
      })

      context('when the source is not zero', async () => {
        const source = ONES_ADDRESS

        it('can be set', async () => {
          const tx = await task.setTokensSource(source)

          expect(await task.tokensSource()).to.include(source)
          await assertEvent(tx, 'TokensSourceSet', { source })
        })
      })

      context('when the source is zero', async () => {
        const source = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.setTokensSource(source)).to.be.revertedWith('TASK_TOKENS_SOURCE_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setTokensSource(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
