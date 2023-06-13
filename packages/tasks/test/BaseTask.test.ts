import { assertEvent, deploy, deployProxy, fp, getSigners, NATIVE_TOKEN_ADDRESS } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('BaseTask', () => {
  let task: Contract, smartVault: Contract
  let authorizer: Contract, priceOracle: Contract, registry: Contract, feeController: Contract, wrappedNT: Contract
  let owner: SignerWithAddress, other: SignerWithAddress, mimic: SignerWithAddress, feeCollector: SignerWithAddress

  before('setup signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, mimic, feeCollector] = await getSigners()
  })

  before('create dependencies', async () => {
    wrappedNT = await deploy('WrappedNativeTokenMock')
    registry = await deploy('@mimic-fi/v3-registry/artifacts/contracts/Registry.sol/Registry', [mimic.address])
    feeController = await deploy('@mimic-fi/v3-fee-controller/artifacts/contracts/FeeController.sol/FeeController', [
      0,
      feeCollector.address,
      mimic.address,
    ])
    priceOracle = await deploy('@mimic-fi/v3-price-oracle/artifacts/contracts/PriceOracle.sol/PriceOracle', [
      wrappedNT.address,
    ])
    await registry.connect(mimic).register('price-oracle@0.0.1', priceOracle.address)
  })

  beforeEach('create smart vault', async () => {
    authorizer = await deployProxy(
      '@mimic-fi/v3-authorizer/artifacts/contracts/Authorizer.sol/Authorizer',
      [],
      [[owner.address]]
    )
    smartVault = await deployProxy(
      '@mimic-fi/v3-smart-vault/artifacts/contracts/SmartVault.sol/SmartVault',
      [registry.address, feeController.address, wrappedNT.address],
      [authorizer.address, priceOracle.address, []]
    )
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy('BaseTaskMock', [], [{ groupId: 0, smartVault: smartVault.address }])
  })

  describe('initialization', async () => {
    it('cannot be initialized twice', async () => {
      await expect(task.initialize({ groupId: 0, smartVault: smartVault.address })).to.be.revertedWith(
        'Initializable: contract is already initialized'
      )
    })
  })

  describe('setGroupId', () => {
    const groupId = 1

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setGroupIdRole = await task.interface.getSighash('setGroupId')
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

  describe('pause', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const pauseRole = await task.interface.getSighash('pause')
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
        const unpauseRole = await task.interface.getSighash('unpause')
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
        const transferToSmartVaultRole = await task.interface.getSighash('transferToSmartVault')
        await authorizer.connect(owner).authorize(owner.address, task.address, transferToSmartVaultRole, [])
        task = task.connect(owner)
      })

      context('when the token is ETH', () => {
        const token = NATIVE_TOKEN_ADDRESS

        beforeEach('fund task', async () => {
          await other.sendTransaction({ to: task.address, value: balance })
        })

        it('transfers it to smart vault', async () => {
          const previousTaskBalance = await task.getTaskBalance(token)
          const previousSmartVaultBalance = await task.getSmartVaultBalance(token)

          await task.transferToSmartVault(token, balance)

          const currentTaskBalance = await task.getTaskBalance(token)
          expect(currentTaskBalance).to.be.equal(previousTaskBalance.sub(balance))

          const currentSmartVaultBalance = await task.getSmartVaultBalance(token)
          expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.add(balance))
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
        })
      })
    })

    context('when the sender does not have permissions', async () => {
      beforeEach('set sender', async () => {
        task = task.connect(other)
      })

      it('reverts', async () => {
        await expect(task.transferToSmartVault(NATIVE_TOKEN_ADDRESS, balance)).to.be.revertedWith('SENDER_NOT_ALLOWED')
      })
    })
  })
})
