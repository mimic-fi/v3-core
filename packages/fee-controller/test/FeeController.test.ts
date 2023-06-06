import { assertEvent, deploy, fp, getSigners, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('FeeController', () => {
  const FEE_PCT = fp(0.01)

  let feeController: Contract, owner: SignerWithAddress, other: SignerWithAddress, collector: SignerWithAddress

  // eslint-disable-next-line no-secrets/no-secrets
  const smartVault = '0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5'

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, collector] = await getSigners()
  })

  beforeEach('create registry', async () => {
    feeController = await deploy('FeeController', [FEE_PCT, collector.address, owner.address])
  })

  describe('initialization', () => {
    it('sets the default percentage correctly', async () => {
      expect(await feeController.getDefaultFeePercentage()).to.be.equal(FEE_PCT)
      expect(await feeController.getFeePercentage(smartVault)).to.be.equal(FEE_PCT)
    })

    it('sets the default collector correctly', async () => {
      expect(await feeController.getDefaultFeeCollector()).to.be.equal(collector.address)
      expect(await feeController.getFeeCollector(smartVault)).to.be.equal(collector.address)
    })

    it('sets the owner correctly', async () => {
      expect(await feeController.owner()).to.be.equal(owner.address)
    })
  })

  describe('setDefaultPercentage', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', () => {
        feeController = feeController.connect(owner)
      })

      context('when the new percentage is below 1', () => {
        const newFeePct = FEE_PCT.add(1)

        it('sets the default fee percentage', async () => {
          const tx = await feeController.setDefaultFeePercentage(newFeePct)

          await assertEvent(tx, 'DefaultFeePercentageSet', { pct: newFeePct })

          expect(await feeController.getDefaultFeePercentage()).to.be.equal(newFeePct)
          expect(await feeController.getFeePercentage(smartVault)).to.be.equal(newFeePct)
        })
      })

      context('when the new percentage is above 1', () => {
        const newFeePct = fp(1).add(1)

        it('reverts', async () => {
          await expect(feeController.setDefaultFeePercentage(newFeePct)).to.be.revertedWith(
            'FEE_CONTROLLER_PCT_ABOVE_ONE'
          )
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        feeController = feeController.connect(other)
      })

      it('reverts', async () => {
        await expect(feeController.setDefaultFeePercentage(0)).to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })

  describe('setDefaultCollector', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', () => {
        feeController = feeController.connect(owner)
      })

      context('when the new collector is not zero', () => {
        const newCollector = '0x0000000000000000000000000000000000000001'

        it('sets the default fee collector', async () => {
          const tx = await feeController.setDefaultFeeCollector(newCollector)

          await assertEvent(tx, 'DefaultFeeCollectorSet', { collector: newCollector })

          expect(await feeController.getDefaultFeeCollector()).to.be.equal(newCollector)
          expect(await feeController.getFeeCollector(smartVault)).to.be.equal(newCollector)
        })
      })

      context('when the new collector is the address zero', () => {
        const newCollector = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(feeController.setDefaultFeeCollector(newCollector)).to.be.revertedWith(
            'FEE_CONTROLLER_COLLECTOR_ZERO'
          )
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        feeController = feeController.connect(other)
      })

      it('reverts', async () => {
        await expect(feeController.setDefaultFeeCollector(ZERO_ADDRESS)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        )
      })
    })
  })

  describe('setCustomPercentage', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', () => {
        feeController = feeController.connect(owner)
      })

      context('when the new percentage is below 1', () => {
        const newFeePct = FEE_PCT.add(1)

        it('sets the custom fee percentage', async () => {
          const tx = await feeController.setCustomFeePercentage(smartVault, newFeePct)

          await assertEvent(tx, 'CustomFeePercentageSet', { smartVault, pct: newFeePct })

          expect(await feeController.getFeePercentage(smartVault)).to.be.equal(newFeePct)

          expect(await feeController.getDefaultFeePercentage()).to.be.equal(FEE_PCT)
          expect(await feeController.getFeePercentage(ZERO_ADDRESS)).to.be.equal(FEE_PCT)
        })
      })

      context('when the new percentage is above 1', () => {
        const newFeePct = fp(1).add(1)

        it('reverts', async () => {
          await expect(feeController.setCustomFeePercentage(smartVault, newFeePct)).to.be.revertedWith(
            'FEE_CONTROLLER_PCT_ABOVE_ONE'
          )
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        feeController = feeController.connect(other)
      })

      it('reverts', async () => {
        await expect(feeController.setCustomFeePercentage(smartVault, 0)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        )
      })
    })
  })

  describe('setCustomCollector', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', () => {
        feeController = feeController.connect(owner)
      })

      context('when the new collector is not zero', () => {
        const newCollector = '0x0000000000000000000000000000000000000001'

        it('sets the custom fee collector', async () => {
          const tx = await feeController.setCustomFeeCollector(smartVault, newCollector)

          await assertEvent(tx, 'CustomFeeCollectorSet', { smartVault, collector: newCollector })

          expect(await feeController.getFeeCollector(smartVault)).to.be.equal(newCollector)

          expect(await feeController.getDefaultFeeCollector()).to.be.equal(collector.address)
          expect(await feeController.getFeeCollector(ZERO_ADDRESS)).to.be.equal(collector.address)
        })
      })

      context('when the new collector is the address zero', () => {
        const collector = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(feeController.setCustomFeeCollector(smartVault, collector)).to.be.revertedWith(
            'FEE_CONTROLLER_COLLECTOR_ZERO'
          )
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        feeController = feeController.connect(other)
      })

      it('reverts', async () => {
        await expect(feeController.setCustomFeeCollector(smartVault, ZERO_ADDRESS)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        )
      })
    })
  })
})
