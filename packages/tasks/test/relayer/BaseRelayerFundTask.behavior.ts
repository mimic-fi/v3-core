import { assertEvent, deploy, deployTokenMock, fp, ZERO_ADDRESS } from '@mimic-fi/helpers'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

export function itBehavesLikeBaseRelayerFundTask(executionType: string): void {
  describe('execution type', () => {
    it('defines it correctly', async function () {
      const expectedType = ethers.utils.solidityKeccak256(['string'], [executionType])
      expect(await this.task.EXECUTION_TYPE()).to.be.equal(expectedType)
    })
  })

  describe('setRelayer', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async function () {
        const setRelayerRole = this.task.interface.getSighash('setRelayer')
        await this.authorizer.connect(this.owner).authorize(this.owner.address, this.task.address, setRelayerRole, [])
        this.task = this.task.connect(this.owner)
      })

      context('when the relayer is not zero', () => {
        it('sets the relayer', async function () {
          await this.task.setRelayer(this.relayer.address)

          expect(await this.task.relayer()).to.be.equal(this.relayer.address)
        })

        it('emits an event', async function () {
          const tx = await this.task.setRelayer(this.relayer.address)

          await assertEvent(tx, 'RelayerSet', { relayer: this.relayer })
        })
      })

      context('when the relayer is zero', () => {
        it('reverts', async function () {
          await expect(this.task.setRelayer(ZERO_ADDRESS)).to.be.revertedWith('TaskRelayerZero')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setRelayer(this.relayer.address)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('getTaskAmount', () => {
    let wrappedNT: string
    let fundingToken: Contract, thresholdToken: Contract
    let fundingThresholdRate: number

    beforeEach('set funding and wrapped native tokens', async function () {
      wrappedNT = await this.smartVault.wrappedNativeToken()
      fundingToken = await deployTokenMock('TKN')
    })

    const itComputesTaskAmountProperly = () => {
      const thresholdMin = fp(100)
      const thresholdMax = thresholdMin.mul(10)
      const thresholdNativeRate = 10 // 10 threshold tokens = 1 native token

      beforeEach('set threshold', async function () {
        const setDefaultTokenThresholdRole = this.task.interface.getSighash('setDefaultTokenThreshold')
        await this.authorizer
          .connect(this.owner)
          .authorize(this.owner.address, this.task.address, setDefaultTokenThresholdRole, [])
        await this.task.connect(this.owner).setDefaultTokenThreshold(thresholdToken.address, thresholdMin, thresholdMax)
      })

      beforeEach('set price feed', async function () {
        const feed = await deploy('FeedMock', [fp(thresholdNativeRate), 18])
        const setFeedRole = this.priceOracle.interface.getSighash('setFeed')
        await this.authorizer
          .connect(this.owner)
          .authorize(this.owner.address, this.priceOracle.address, setFeedRole, [])
        await this.priceOracle.connect(this.owner).setFeed(wrappedNT, thresholdToken.address, feed.address)
      })

      context('when the used quota is zero', () => {
        beforeEach('set used quota', async function () {
          await this.relayer.setSmartVaultUsedQuota(this.smartVault.address, 0)
        })

        context('when the deposited balance is below the min threshold', () => {
          const deposited = thresholdMin.div(thresholdNativeRate).sub(1)

          beforeEach('set deposited balance', async function () {
            await this.relayer.deposit(this.smartVault.address, deposited)
          })

          it('returns max threshold minus deposited balance', async function () {
            const taskAmount = await this.task.getTaskAmount(fundingToken.address)
            const expectedTaskAmount = thresholdMax.sub(deposited.mul(thresholdNativeRate)).mul(fundingThresholdRate)
            expect(taskAmount).to.be.equal(expectedTaskAmount)
          })
        })

        context('when the balance is above the min threshold', () => {
          const deposited = thresholdMin.div(thresholdNativeRate)

          beforeEach('set deposited balance', async function () {
            await this.relayer.deposit(this.smartVault.address, deposited)
          })

          it('returns zero', async function () {
            expect(await this.task.getTaskAmount(fundingToken.address)).to.be.equal(0)
          })
        })
      })

      context('when the used quota is not zero', () => {
        const usedQuota = fp(1)

        beforeEach('set used quota', async function () {
          await this.relayer.setSmartVaultUsedQuota(this.smartVault.address, usedQuota)
        })

        it('returns the max threshold plus the used quota', async function () {
          const taskAmount = await this.task.getTaskAmount(fundingToken.address)
          const expectedTaskAmount = thresholdMax.add(usedQuota.mul(thresholdNativeRate)).mul(fundingThresholdRate)
          expect(taskAmount).to.be.equal(expectedTaskAmount)
        })
      })
    }

    context('when threshold and funding token are different', () => {
      beforeEach('set threshold token', async function () {
        thresholdToken = await deployTokenMock('TKN')
        fundingThresholdRate = 2 // 2 `fundingToken` = 1 `thresholdToken`
      })

      beforeEach('set price feed', async function () {
        const feed = await deploy('FeedMock', [fp(fundingThresholdRate), 18])
        const setFeedRole = this.priceOracle.interface.getSighash('setFeed')
        await this.authorizer
          .connect(this.owner)
          .authorize(this.owner.address, this.priceOracle.address, setFeedRole, [])
        await this.priceOracle.connect(this.owner).setFeed(thresholdToken.address, fundingToken.address, feed.address)
      })

      itComputesTaskAmountProperly()
    })

    context('when threshold and funding token are the same', () => {
      beforeEach('set threshold token', async function () {
        thresholdToken = fundingToken
        fundingThresholdRate = 1 // 1 `fundingToken` = 1 `thresholdToken`
      })

      itComputesTaskAmountProperly()
    })
  })
}
