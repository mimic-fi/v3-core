import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  deployFeedMock,
  deployProxy,
  deployTokenMock,
  fp,
  getSigners,
  MAX_UINT256,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment, Mimic } from '../../src/setup'
import { itBehavesLikeBaseRelayerFunder } from './BaseRelayerFunder.behavior'

describe('UnwrapperRelayerFunder', () => {
  let task: Contract, relayer: Contract
  let smartVault: Contract, authorizer: Contract, priceOracle: Contract, mimic: Mimic, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ mimic, authorizer, smartVault, priceOracle } = await deployEnvironment(owner))
  })

  before('deploy relayer', async () => {
    relayer = await deploy('RelayerMock', [0])
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'UnwrapperRelayerFunder',
      [],
      [
        {
          baseRelayerFunderConfig: {
            relayer: relayer.address,
            taskConfig: buildEmptyTaskConfig(owner, smartVault),
          },
          unwrapConfig: {
            taskConfig: buildEmptyTaskConfig(owner, smartVault),
          },
        },
      ],
      'initialize(((address,((address,bytes32,bytes32),(uint256,uint256,uint256,uint256),(uint256,uint256,uint256),(uint8,address[]),((address,uint256,uint256),(address,(address,uint256,uint256))[]),((address,uint256,uint256),(address,(address,uint256,uint256))[]))),(((address,bytes32,bytes32),(uint256,uint256,uint256,uint256),(uint256,uint256,uint256),(uint8,address[]),((address,uint256,uint256),(address,(address,uint256,uint256))[]),((address,uint256,uint256),(address,(address,uint256,uint256))[])))))'
    )
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

    itBehavesLikeBaseRelayerFunder('UNWRAPPER')
  })

  describe('unwrapper', () => {
    // copy-paste from Unwrapper test `call`, modifying threshold settings

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
        let tokenAddr: string

        beforeEach('set token', async () => {
          tokenAddr = mimic.wrappedNativeToken.address
        })

        context('when the given amount is greater than zero', () => {
          const amount = fp(0.02)

          beforeEach('fund smart vault', async () => {
            await mimic.wrappedNativeToken.connect(owner).deposit({ value: amount })
            await mimic.wrappedNativeToken.connect(owner).transfer(smartVault.address, amount)
          })

          context('when the balance is below the min threshold', () => {
            const thresholdMin = amount.mul(2)
            const thresholdMax = thresholdMin.mul(2)

            beforeEach('set smart vault balance in relayer', async function () {
              await relayer.setBalance(amount)
            })

            beforeEach('set default token threshold', async () => {
              const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
              await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
              await task.connect(owner).setDefaultTokenThreshold(tokenAddr, thresholdMin, thresholdMax)
            })

            it('calls the unwrap primitive', async () => {
              const tx = await task.call(tokenAddr, amount)
              await assertIndirectEvent(tx, smartVault.interface, 'Unwrapped', { amount })
            })

            it('emits an Executed event', async () => {
              const tx = await task.call(tokenAddr, amount)
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

              const tx = await task.call(tokenAddr, amount)

              await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
                id: nextConnectorId,
                token: NATIVE_TOKEN_ADDRESS,
                amount,
                added: true,
              })
            })
          })

          context('when the balance is above the min threshold', () => {
            const threshold = amount.div(2)

            beforeEach('set smart vault balance in relayer', async function () {
              await relayer.setBalance(amount)
            })

            beforeEach('set default token threshold', async () => {
              const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
              await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
              await task.connect(owner).setDefaultTokenThreshold(tokenAddr, threshold, MAX_UINT256)
            })

            it('reverts', async () => {
              await expect(task.call(tokenAddr, amount)).to.be.revertedWith('TASK_TOKEN_THRESHOLD_NOT_MET')
            })
          })
        })

        context('when the given amount is zero', () => {
          const amount = 0
          const threshold = MAX_UINT256

          beforeEach('set default token threshold', async () => {
            const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
            await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
            await task.connect(owner).setDefaultTokenThreshold(tokenAddr, threshold, threshold)
          })

          it('reverts', async () => {
            await expect(task.call(tokenAddr, amount)).to.be.revertedWith('TASK_AMOUNT_ZERO')
          })
        })
      })

      context('when the given token is not the wrapped native token', () => {
        let token: Contract
        const threshold = MAX_UINT256

        beforeEach('set token in', async () => {
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
          await expect(task.call(token.address, 0)).to.be.revertedWith('TASK_TOKEN_NOT_WRAPPED')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(ZERO_ADDRESS, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
