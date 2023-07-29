import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  deployFeedMock,
  deployProxy,
  deployTokenMock,
  fp,
  getSigners,
  ZERO_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment, Mimic } from '../../src/setup'
import { itBehavesLikeBaseRelayerFundTask } from './BaseRelayerFundTask.behavior'

/* eslint-disable no-secrets/no-secrets */

describe('UnwrapperRelayerFunder', () => {
  let task: Contract, relayer: Contract
  let smartVault: Contract, authorizer: Contract, priceOracle: Contract, mimic: Mimic, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ mimic, authorizer, smartVault, priceOracle } = await deployEnvironment(owner))
  })

  before('deploy relayer', async () => {
    relayer = await deploy('RelayerMock', [])
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'UnwrapperRelayerFunder',
      [],
      [
        {
          taskConfig: buildEmptyTaskConfig(owner, smartVault),
        },
        relayer.address,
      ],
      'initializeUnwrapperRelayerFunder'
    )
  })

  describe('initialization', async () => {
    it('cannot call parent initialize', async () => {
      await expect(
        task.initialize({
          taskConfig: buildEmptyTaskConfig(owner, smartVault),
        })
      ).to.be.revertedWith('TaskInitializerDisabled')
    })

    it('has a relayer reference', async () => {
      expect(await task.relayer()).to.be.equal(relayer.address)
    })
  })

  describe('relayer funder', () => {
    beforeEach('set params', async function () {
      this.owner = owner
      this.task = task
      this.authorizer = authorizer
      this.priceOracle = priceOracle
      this.smartVault = smartVault
      this.relayer = relayer
    })

    itBehavesLikeBaseRelayerFundTask('UNWRAPPER')
  })

  describe('unwrapper', () => {
    beforeEach('authorize task', async () => {
      const unwrapRole = smartVault.interface.getSighash('unwrap')
      await authorizer.connect(owner).authorize(task.address, smartVault.address, unwrapRole, [])
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = task.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, task.address, callRole, [])
        task = task.connect(owner)
      })

      context('when the given token is the wrapped native token', () => {
        let token: Contract
        const amount = fp(0.2)

        beforeEach('set token', async () => {
          token = mimic.wrappedNativeToken
        })

        beforeEach('fund smart vault', async () => {
          await mimic.wrappedNativeToken.connect(owner).deposit({ value: amount.mul(10) })
          await mimic.wrappedNativeToken.connect(owner).transfer(smartVault.address, amount.mul(10))
        })

        context('when the balance is below the min threshold', () => {
          const thresholdMin = amount.mul(2)
          const thresholdMax = thresholdMin.mul(2)

          beforeEach('set smart vault balance in relayer', async function () {
            const balance = await relayer.getSmartVaultBalance(smartVault.address)
            await relayer.withdraw(smartVault.address, balance)
            await relayer.deposit(smartVault.address, amount)
          })

          beforeEach('set default token threshold', async () => {
            const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
            await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
            await task.connect(owner).setDefaultTokenThreshold(token.address, thresholdMin, thresholdMax)
          })

          context('when the resulting balance is below the max threshold', () => {
            it('calls the unwrap primitive', async () => {
              const tx = await task.call(token.address, amount)
              await assertIndirectEvent(tx, smartVault.interface, 'Unwrapped', { amount })
            })

            it('emits an Executed event', async () => {
              const tx = await task.call(token.address, amount)
              await assertEvent(tx, 'Executed')
            })
          })

          context('when the resulting balance is above the max threshold', async () => {
            const diff = thresholdMax.sub(amount)
            const bigAmount = amount.add(diff.add(1))

            it('reverts', async () => {
              await expect(task.call(token.address, bigAmount)).to.be.revertedWith('TaskDepositAboveMaxThreshold')
            })
          })
        })

        context('when the balance is above the min threshold', () => {
          const threshold = amount.div(2)

          beforeEach('set smart vault balance in relayer', async function () {
            const balance = await relayer.getSmartVaultBalance(smartVault.address)
            await relayer.withdraw(smartVault.address, balance)
            await relayer.deposit(smartVault.address, amount)
          })

          beforeEach('set default token threshold', async () => {
            const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
            await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
            await task.connect(owner).setDefaultTokenThreshold(token.address, threshold, fp(10000))
          })

          it('reverts', async () => {
            await expect(task.call(token.address, amount)).to.be.revertedWith('TaskDepositAboveMinThreshold')
          })
        })
      })

      context('when the given token is not the wrapped native token', () => {
        let token: Contract
        const threshold = fp(10000)

        beforeEach('set token', async () => {
          token = await deployTokenMock('TKN')
        })

        beforeEach('set price feed', async function () {
          const feed = await deployFeedMock(fp(1), 18)
          const setFeedRole = priceOracle.interface.getSighash('setFeed')
          await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
          await priceOracle.connect(owner).setFeed(mimic.wrappedNativeToken.address, token.address, feed.address)
        })

        beforeEach('set default token threshold', async () => {
          const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
          await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
          await task.connect(owner).setDefaultTokenThreshold(token.address, threshold, threshold)
        })

        it('reverts', async () => {
          await expect(task.call(token.address, 0)).to.be.revertedWith('TaskTokenNotWrapped')
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
