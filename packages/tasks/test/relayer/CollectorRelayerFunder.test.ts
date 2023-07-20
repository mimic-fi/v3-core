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
  ZERO_BYTES32,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment } from '../../src/setup'
import { itBehavesLikeBaseRelayerFundTask } from './BaseRelayerFundTask.behavior'

describe('CollectorRelayerFunder', () => {
  let task: Contract, relayer: Contract
  let smartVault: Contract, authorizer: Contract, priceOracle: Contract
  let owner: SignerWithAddress, tokensSource: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner, tokensSource] = await getSigners())
    ;({ authorizer, smartVault, priceOracle } = await deployEnvironment(owner))
  })

  before('deploy relayer', async () => {
    relayer = await deploy('RelayerMock', [])
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'CollectorRelayerFunder',
      [],
      [
        {
          tokensSource: tokensSource.address,
          taskConfig: buildEmptyTaskConfig(owner, smartVault),
        },
        relayer.address,
      ],
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
      ).to.be.revertedWith('COLLECTOR_INITIALIZER_DISABLED')
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
    let token: Contract

    const amount = fp(10) // in usdc
    const tokenRate = 2000 // 1 eth = 2000 usdc

    beforeEach('set token', async () => {
      token = await deployTokenMock('USDC')
    })

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

      beforeEach('set tokens acceptance type', async () => {
        const setTokensAcceptanceTypeRole = task.interface.getSighash('setTokensAcceptanceType')
        await authorizer.connect(owner).authorize(owner.address, task.address, setTokensAcceptanceTypeRole, [])
        await task.connect(owner).setTokensAcceptanceType(1)
      })

      context('when the given token is allowed', () => {
        beforeEach('set tokens acceptance list', async () => {
          const setTokensAcceptanceListRole = task.interface.getSighash('setTokensAcceptanceList')
          await authorizer.connect(owner).authorize(owner.address, task.address, setTokensAcceptanceListRole, [])
          await task.connect(owner).setTokensAcceptanceList([token.address], [true])
        })

        beforeEach('set price feed', async function () {
          const feed = await deployFeedMock(fp(tokenRate), 18)
          const setFeedRole = priceOracle.interface.getSighash('setFeed')
          const wrappedNativeToken = await smartVault.wrappedNativeToken()
          await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
          await priceOracle.connect(owner).setFeed(wrappedNativeToken, token.address, feed.address)
        })

        context('when the balance is below the min threshold', () => {
          const thresholdMin = amount.mul(2) // in usdc
          const thresholdMax = thresholdMin.mul(2) // in usdc

          beforeEach('allow smart vault', async () => {
            await token.mint(tokensSource.address, amount)
            await token.connect(tokensSource).approve(smartVault.address, amount)
          })

          beforeEach('set smart vault balance in relayer', async function () {
            const balance = await relayer.getSmartVaultBalance(smartVault.address)
            await relayer.withdraw(smartVault.address, balance)

            const amountInNativeToken = amount.div(tokenRate)
            await relayer.deposit(smartVault.address, amountInNativeToken)
          })

          beforeEach('set default token threshold', async () => {
            const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
            await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
            await task.connect(owner).setDefaultTokenThreshold(token.address, thresholdMin, thresholdMax)
          })

          context('when the resulting balance is below the max threshold', () => {
            it('calls the collect primitive', async () => {
              const tx = await task.call(token.address, amount)

              await assertIndirectEvent(tx, smartVault.interface, 'Collected', { token, from: tokensSource, amount })
            })

            it('emits an Executed event', async () => {
              const tx = await task.call(token.address, amount)

              await assertEvent(tx, 'Executed')
            })

            it('updates the balance connectors properly', async () => {
              const nextConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000002'
              const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
              await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
              await task.connect(owner).setBalanceConnectors(ZERO_BYTES32, nextConnectorId)

              const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
              await authorizer
                .connect(owner)
                .authorize(task.address, smartVault.address, updateBalanceConnectorRole, [])

              const tx = await task.call(token.address, amount)

              await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
                id: nextConnectorId,
                token,
                amount,
                added: true,
              })
            })
          })

          context('when the resulting balance is above the max threshold', () => {
            const diff = thresholdMax.sub(amount)
            const bigAmount = amount.add(diff.add(1))

            it('reverts', async () => {
              await expect(task.call(token.address, bigAmount)).to.be.revertedWith('TASK_AMOUNT_ABOVE_THRESHOLD')
            })
          })
        })

        context('when the balance is above the min threshold', () => {
          const threshold = amount.div(2)

          beforeEach('set smart vault balance in relayer', async function () {
            const balance = await relayer.getSmartVaultBalance(smartVault.address)
            await relayer.withdraw(smartVault.address, balance)

            const amountInNativeToken = amount.div(tokenRate)
            await relayer.deposit(smartVault.address, amountInNativeToken)
          })

          beforeEach('set default token threshold', async () => {
            const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
            await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
            await task.connect(owner).setDefaultTokenThreshold(token.address, threshold, fp(10000))
          })

          it('reverts', async () => {
            await expect(task.call(token.address, amount)).to.be.revertedWith('TASK_TOKEN_THRESHOLD_NOT_MET')
          })
        })
      })

      context('when the given token is not allowed', () => {
        it('reverts', async () => {
          await expect(task.call(NATIVE_TOKEN_ADDRESS, 0)).to.be.revertedWith('TASK_TOKEN_NOT_ALLOWED')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(token.address, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
