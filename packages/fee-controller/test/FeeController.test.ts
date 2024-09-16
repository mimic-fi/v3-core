import { assertEvent, assertNoEvent, BigNumberish, deploy, fp, getSigners, ZERO_ADDRESS } from '@mimic-fi/helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('FeeController', () => {
  let feeController: Contract, owner: SignerWithAddress, other: SignerWithAddress, collector: SignerWithAddress

  // eslint-disable-next-line no-secrets/no-secrets
  const smartVault = '0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5'

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, collector] = await getSigners()
  })

  beforeEach('create registry', async () => {
    feeController = await deploy('FeeController', [collector.address, owner.address])
  })

  describe('initialization', () => {
    it('sets the default collector correctly', async () => {
      expect(await feeController.defaultFeeCollector()).to.be.equal(collector.address)
      expect(await feeController.hasFee(smartVault)).to.be.false
      await expect(feeController.getFee(smartVault)).to.be.revertedWith('FeeControllerMaxPctNotSet')
    })

    it('sets the owner correctly', async () => {
      expect(await feeController.owner()).to.be.equal(owner.address)
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

          expect(await feeController.defaultFeeCollector()).to.be.equal(newCollector)
        })
      })

      context('when the new collector is the address zero', () => {
        const newCollector = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(feeController.setDefaultFeeCollector(newCollector)).to.be.revertedWith(
            'FeeControllerCollectorZero'
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

  describe('setMaxFeePercentage', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', () => {
        feeController = feeController.connect(owner)
      })

      const itSetsTheMaxFeePercentage = (maxPct: BigNumberish) => {
        it('sets the max fee percentage', async () => {
          const tx = await feeController.setMaxFeePercentage(smartVault, maxPct)

          await assertEvent(tx, 'MaxFeePercentageSet', { smartVault, maxPct })

          const fee = await feeController.getFee(smartVault)
          expect(fee.max).to.be.equal(maxPct)
        })
      }

      const itUpdatesTheFeePercentage = (maxPct: BigNumberish) => {
        it('sets the fee percentage', async () => {
          const tx = await feeController.setMaxFeePercentage(smartVault, maxPct)

          await assertEvent(tx, 'FeePercentageSet', { smartVault, pct: maxPct })

          const fee = await feeController.getFee(smartVault)
          expect(fee.pct).to.be.equal(maxPct)
        })
      }

      const itDoesNotUpdateTheFeePercentage = (maxPct: BigNumberish) => {
        it('sets the fee percentage', async () => {
          const previousFee = await feeController.getFee(smartVault)

          const tx = await feeController.setMaxFeePercentage(smartVault, maxPct)
          await assertNoEvent(tx, 'FeePercentageSet')

          const currentFee = await feeController.getFee(smartVault)
          expect(currentFee.pct).to.be.equal(previousFee.pct)
        })
      }

      context('when there was no max set for the given smart vault', () => {
        context('when the new percentage is below 1', () => {
          const maxPct = fp(0.1)

          itSetsTheMaxFeePercentage(maxPct)
          itUpdatesTheFeePercentage(maxPct)
        })

        context('when the new percentage is above 1', () => {
          const newFeePct = fp(1).add(1)

          it('reverts', async () => {
            await expect(feeController.setMaxFeePercentage(smartVault, newFeePct)).to.be.revertedWith(
              'FeeControllerMaxPctAboveOne'
            )
          })
        })
      })

      context('when there was one already set for the given smart vault', () => {
        const maxPct = fp(0.1)

        context('when the new percentage is below the previous', () => {
          const previousMaxPct = maxPct.add(1)

          beforeEach('set max fee percentage', async () => {
            await feeController.setMaxFeePercentage(smartVault, previousMaxPct)
          })

          context('when the new max is below the previous pct', () => {
            const feePct = maxPct.add(1)

            beforeEach('set max fee percentage', async () => {
              await feeController.setFeePercentage(smartVault, feePct)
            })

            itSetsTheMaxFeePercentage(maxPct)
            itUpdatesTheFeePercentage(maxPct)
          })

          context('when the new max is above the previous pct', () => {
            const feePct = maxPct.sub(1)

            beforeEach('set max fee percentage', async () => {
              await feeController.setFeePercentage(smartVault, feePct)
            })

            itSetsTheMaxFeePercentage(maxPct)
            itDoesNotUpdateTheFeePercentage(maxPct)
          })
        })

        context('when the new percentage is above the previous', () => {
          const previousMaxPct = maxPct.sub(1)

          beforeEach('set max fee percentage', async () => {
            await feeController.setMaxFeePercentage(smartVault, previousMaxPct)
          })

          it('reverts', async () => {
            await expect(feeController.setMaxFeePercentage(smartVault, maxPct)).to.be.revertedWith(
              'FeeControllerMaxPctAbovePrevious'
            )
          })
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        feeController = feeController.connect(other)
      })

      it('reverts', async () => {
        await expect(feeController.setMaxFeePercentage(smartVault, 0)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        )
      })
    })
  })

  describe('setFeePercentage', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', () => {
        feeController = feeController.connect(owner)
      })

      context('when there was a max set for the given smart vault', () => {
        const maxFeePct = fp(0.1)

        beforeEach('set max fee percentage', async () => {
          await feeController.setMaxFeePercentage(smartVault, maxFeePct)
        })

        context('when the new percentage is below the max', () => {
          const feePct = maxFeePct.sub(1)

          it('sets the fee percentage', async () => {
            const tx = await feeController.setFeePercentage(smartVault, feePct)
            await assertEvent(tx, 'FeePercentageSet', { smartVault, pct: feePct })

            const fee = await feeController.getFee(smartVault)
            expect(fee.pct).to.be.equal(feePct)
            expect(fee.max).to.be.equal(maxFeePct)
          })
        })

        context('when the new percentage is above the max', () => {
          const feePct = maxFeePct.add(1)

          it('reverts', async () => {
            await expect(feeController.setFeePercentage(smartVault, feePct)).to.be.revertedWith(
              'FeeControllerPctAboveMax'
            )
          })
        })
      })

      context('when there was no max set for the given smart vault', () => {
        const feePct = fp(0.01)

        it('reverts', async () => {
          await expect(feeController.setFeePercentage(smartVault, feePct)).to.be.revertedWith(
            'FeeControllerMaxPctNotSet'
          )
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        feeController = feeController.connect(other)
      })

      it('reverts', async () => {
        await expect(feeController.setFeePercentage(smartVault, 0)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        )
      })
    })
  })

  describe('setFeeCollector', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', () => {
        feeController = feeController.connect(owner)
      })

      context('when the new collector is not zero', () => {
        const newCollector = '0x0000000000000000000000000000000000000001'

        context('when there was a max set for the given smart vault', () => {
          beforeEach('set max fee pct', async () => {
            await feeController.setMaxFeePercentage(smartVault, fp(0.1))
          })

          it('sets the custom fee collector', async () => {
            const tx = await feeController.setFeeCollector(smartVault, newCollector)

            await assertEvent(tx, 'FeeCollectorSet', { smartVault, collector: newCollector })

            const fee = await feeController.getFee(smartVault)
            expect(fee.collector).to.be.equal(newCollector)
          })
        })

        context('when there was no max set for the given smart vault', () => {
          it('reverts', async () => {
            await expect(feeController.setFeeCollector(smartVault, newCollector)).to.be.revertedWith(
              'FeeControllerMaxPctNotSet'
            )
          })
        })
      })

      context('when the new collector is the address zero', () => {
        const collector = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(feeController.setFeeCollector(smartVault, collector)).to.be.revertedWith(
            'FeeControllerCollectorZero'
          )
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        feeController = feeController.connect(other)
      })

      it('reverts', async () => {
        await expect(feeController.setFeeCollector(smartVault, ZERO_ADDRESS)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        )
      })
    })
  })
})
