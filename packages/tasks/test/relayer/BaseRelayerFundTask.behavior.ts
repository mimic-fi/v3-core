import { assertEvent, deployFeedMock, deployTokenMock, fp, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
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
          await expect(this.task.setRelayer(ZERO_ADDRESS)).to.be.revertedWith('TASK_FUNDER_RELAYER_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setRelayer(this.relayer.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('getTaskAmount', () => {
    let wrappedNT: string
    let fundingToken: Contract, thresholdToken: Contract
    let fundingThresholdRate: number

    const thresholdMin = fp(100)
    const thresholdMax = fp(1000)

    beforeEach('set wrapped native token', async function () {
      wrappedNT = await this.smartVault.wrappedNativeToken()
    })

    beforeEach('authorize sender', async function () {
      const getTaskAmountRole = this.task.interface.getSighash('getTaskAmount')
      await this.authorizer.connect(this.owner).authorize(this.owner.address, this.task.address, getTaskAmountRole, [])
      this.task = this.task.connect(this.owner)
    })

    beforeEach('set funding token', async function () {
      fundingToken = await deployTokenMock('TKN')
    })

    const itComputesTaskAmountProperly = () => {
      const thresholdNativeRate = 10 // 10 `thresholdToken` = 1 native token

      beforeEach('set threshold', async function () {
        const setDefaultTokenThresholdRole = this.task.interface.getSighash('setDefaultTokenThreshold')
        await this.authorizer
          .connect(this.owner)
          .authorize(this.owner.address, this.task.address, setDefaultTokenThresholdRole, [])
        await this.task.connect(this.owner).setDefaultTokenThreshold(thresholdToken.address, thresholdMin, thresholdMax)
      })

      beforeEach('set price feed', async function () {
        const feed = await deployFeedMock(fp(thresholdNativeRate), 18)
        const setFeedRole = this.priceOracle.interface.getSighash('setFeed')
        await this.authorizer
          .connect(this.owner)
          .authorize(this.owner.address, this.priceOracle.address, setFeedRole, [])
        await this.priceOracle.connect(this.owner).setFeed(wrappedNT, thresholdToken.address, feed.address)
      })

      context('when the balance is below the min threshold', () => {
        const amount = thresholdMin.div(2)

        beforeEach('set smart vault balance in relayer', async function () {
          const balance = await this.relayer.getSmartVaultBalance(this.smartVault.address)
          await this.relayer.withdraw(this.smartVault.address, balance)

          const amountInNativeToken = amount.div(thresholdNativeRate)
          await this.relayer.deposit(this.smartVault.address, amountInNativeToken)
        })

        it('returns max threshold minus deposited balance', async function () {
          const taskAmount = await this.task.getTaskAmount(fundingToken.address)
          expect(taskAmount.div(fundingThresholdRate)).to.be.equal(thresholdMax.sub(amount))
        })
      })

      context('when the balance is above the min threshold', () => {
        const diff = thresholdMax.sub(thresholdMin)
        const amount = thresholdMin.add(diff.div(2))

        beforeEach('set smart vault balance in relayer', async function () {
          const balance = await this.relayer.getSmartVaultBalance(this.smartVault.address)
          await this.relayer.withdraw(this.smartVault.address, balance)

          const amountInNativeToken = amount.div(thresholdNativeRate)
          await this.relayer.deposit(this.smartVault.address, amountInNativeToken)
        })

        it('returns zero', async function () {
          expect(await this.task.getTaskAmount(fundingToken.address)).to.be.equal(0)
        })
      })
    }

    context('when threshold and funding token are different', () => {
      beforeEach('set threshold token', async function () {
        thresholdToken = await deployTokenMock('OTKN')
      })

      beforeEach('set token rate', async function () {
        fundingThresholdRate = 2 // 2 `fundingToken` = 1 `thresholdToken`
      })

      beforeEach('set price feed', async function () {
        const feed = await deployFeedMock(fp(fundingThresholdRate), 18)
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
      })

      beforeEach('set token rate', async function () {
        fundingThresholdRate = 1 // 1 `fundingToken` = 1 `thresholdToken`
      })

      itComputesTaskAmountProperly()
    })
  })
}
