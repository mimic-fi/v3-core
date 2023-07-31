import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  deployFeedMock,
  deployProxy,
  deployTokenMock,
  fp,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment, Mimic } from '../../src/setup'
import { itBehavesLikeBaseRelayerFundTask } from './BaseRelayerFundTask.behavior'

/* eslint-disable no-secrets/no-secrets */

describe('CollectorRelayerFunder', () => {
  let task: Contract, relayer: Contract
  let smartVault: Contract, authorizer: Contract, priceOracle: Contract, mimic: Mimic
  let owner: SignerWithAddress, tokensSource: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner, tokensSource] = await getSigners())
    ;({ authorizer, smartVault, priceOracle, mimic } = await deployEnvironment(owner))
  })

  beforeEach('deploy task', async () => {
    relayer = await deploy('RelayerMock', [])
    task = await deployProxy(
      'CollectorRelayerFunder',
      [],
      [{ tokensSource: tokensSource.address, taskConfig: buildEmptyTaskConfig(owner, smartVault) }, relayer.address],
      'initializeCollectorRelayerFunder'
    )
  })

  describe('initialization', async () => {
    it('cannot call parent initialize', async () => {
      await expect(
        task.initialize({
          tokensSource: tokensSource.address,
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

    itBehavesLikeBaseRelayerFundTask('COLLECTOR')
  })

  describe('collector', () => {
    beforeEach('authorize task', async () => {
      const collectRole = smartVault.interface.getSighash('collect')
      await authorizer.connect(owner).authorize(task.address, smartVault.address, collectRole, [])
    })

    beforeEach('set tokens source', async () => {
      const setTokensSourceRole = task.interface.getSighash('setTokensSource')
      await authorizer.connect(owner).authorize(owner.address, task.address, setTokensSourceRole, [])
      await task.connect(owner).setTokensSource(tokensSource.address)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = task.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, task.address, callRole, [])
        task = task.connect(owner)
      })

      context('when the given token is not zero', () => {
        let token: Contract
        const tokenRate = 2000 // 1 eth = 2000 usdc

        beforeEach('deploy token', async () => {
          token = await deployTokenMock('USDC')
        })

        beforeEach('set price feed', async function () {
          const feed = await deployFeedMock(fp(tokenRate))
          const setFeedRole = priceOracle.interface.getSighash('setFeed')
          await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
          await priceOracle.connect(owner).setFeed(mimic.wrappedNativeToken.address, token.address, feed.address)
        })

        context('when there is a threshold set for the given token', () => {
          const thresholdMin = fp(1)
          const thresholdMax = thresholdMin.mul(10)

          beforeEach('set default token threshold', async () => {
            const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
            await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
            await task.connect(owner).setDefaultTokenThreshold(token.address, thresholdMin, thresholdMax)
          })

          context('when the used quota is zero', () => {
            context('when the balance is below the min threshold', () => {
              const deposited = thresholdMin.div(tokenRate).sub(1)

              beforeEach('set smart vault balance in relayer', async () => {
                await relayer.deposit(smartVault.address, deposited)
              })

              context('when the resulting balance is below the max threshold', () => {
                const amount = thresholdMax.sub(deposited.mul(tokenRate))

                beforeEach('fund tokens source', async () => {
                  await token.mint(tokensSource.address, amount)
                  await token.connect(tokensSource).approve(smartVault.address, amount)
                })

                it('calls the collect primitive', async () => {
                  const tx = await task.call(token.address, amount)
                  await assertIndirectEvent(tx, smartVault.interface, 'Collected', {
                    token,
                    from: tokensSource,
                    amount,
                  })
                })

                it('emits an Executed event', async () => {
                  const tx = await task.call(token.address, amount)
                  await assertEvent(tx, 'Executed')
                })
              })

              context('when the resulting balance is above the max threshold', () => {
                const amount = thresholdMax.sub(deposited.mul(tokenRate)).add(1)

                it('reverts', async () => {
                  await expect(task.call(token.address, amount)).to.be.revertedWith('TaskNewDepositAboveMaxThreshold')
                })
              })
            })

            context('when the deposited balance is above the min threshold', () => {
              const deposited = thresholdMin.div(tokenRate)

              beforeEach('set smart vault balance in relayer', async () => {
                await relayer.deposit(smartVault.address, deposited)
              })

              it('reverts', async () => {
                await expect(task.call(token.address, 0)).to.be.revertedWith('TaskDepositAboveMinThreshold')
              })
            })
          })

          context('when the used quota is not zero', () => {
            const usedQuota = fp(1)

            beforeEach('set used quota', async () => {
              await relayer.setSmartVaultUsedQuota(smartVault.address, usedQuota)
            })

            context('when the amount covers the used quota', () => {
              context('when the resulting balance is below the max threshold', () => {
                const amount = thresholdMax.add(usedQuota.mul(tokenRate))

                beforeEach('fund tokens source', async () => {
                  await token.mint(tokensSource.address, amount)
                  await token.connect(tokensSource).approve(smartVault.address, amount)
                })

                it('calls the collect primitive', async () => {
                  const tx = await task.call(token.address, amount)
                  await assertIndirectEvent(tx, smartVault.interface, 'Collected', {
                    token,
                    from: tokensSource,
                    amount,
                  })
                })

                it('emits an Executed event', async () => {
                  const tx = await task.call(token.address, amount)
                  await assertEvent(tx, 'Executed')
                })
              })

              context('when the resulting balance is above the max threshold', () => {
                const amount = thresholdMax.add(usedQuota.mul(tokenRate)).add(1)

                it('reverts', async () => {
                  await expect(task.call(token.address, amount)).to.be.revertedWith('TaskNewDepositAboveMaxThreshold')
                })
              })
            })

            context('when the amount does not cover the used quota', () => {
              const amount = usedQuota.mul(tokenRate).sub(1)

              it('reverts', async () => {
                await expect(task.call(token.address, amount)).to.be.revertedWith('TaskDepositBelowUsedQuota')
              })
            })
          })
        })

        context('when there is no threshold set for the given token', () => {
          it('reverts', async () => {
            await expect(task.call(NATIVE_TOKEN_ADDRESS, 0)).to.be.revertedWith('TaskTokenThresholdNotSet')
          })
        })
      })

      context('when the given token is zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.call(token, 0)).to.be.revertedWith('TaskTokenThresholdNotSet')
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
