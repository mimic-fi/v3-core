import { OP } from '@mimic-fi/v3-authorizer'
import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  deployProxy,
  fp,
  getSigners,
  ZERO_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment } from '../../src/setup'
import { itBehavesLikeBaseBridgeTask } from './BaseBridgeTask.behavior'

describe.only('ConnextBridger', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, connector: Contract
  let owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner, ] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  before('deploy connector', async () => {
    connector = await deploy('ConnextConnectorMock')
    const overrideConnectorCheckRole = smartVault.interface.getSighash('overrideConnectorCheck')
    await authorizer.connect(owner).authorize(owner.address, smartVault.address, overrideConnectorCheckRole, [])
    await smartVault.connect(owner).overrideConnectorCheck(connector.address, true)
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'ConnextBridger',
      [],
      [
        {
          connector: connector.address,
          destinationChain: 0,
          customDestinationChains: [],
          taskConfig: buildEmptyTaskConfig(owner, smartVault),
        },
      ]
    )
  })

  describe('bridger', () => {
    beforeEach('set params', async function () {
      this.owner = owner
      this.task = task
      this.authorizer = authorizer
    })

    itBehavesLikeBaseBridgeTask()
  })

  describe('call', () => {
    beforeEach('authorize task', async () => {
      const executeRole = smartVault.interface.getSighash('execute')
      const params = [{ op: OP.EQ, value: connector.address }]
      await authorizer.connect(owner).authorize(task.address, smartVault.address, executeRole, params)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = task.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, task.address, callRole, [])
        task = task.connect(owner)
      })

      context('when the token is not the address zero', () => {
        let token: Contract

        beforeEach('deploy token', async () => {
          token = await deploy('TokenMock', ['TKN'])
        })

        context('when the amount is not zero', () => {
          const amountIn = fp(100)
          const slippage = fp(0.5)
          const relayerFee = amountIn.div(10)
          const minAmountOut = amountIn.sub(amountIn.mul(slippage).div(fp(1)))

          context('when the destination chain was set', () => {
            const chainId = 1

            beforeEach('set destination chain ID', async () => {
              const setDefaultDestinationChainRole = task.interface.getSighash('setDefaultDestinationChain')
              await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultDestinationChainRole, [])
              await task.connect(owner).setDefaultDestinationChain(chainId)
            })

            context('when the given token is allowed', () => {
              context('when the current balance passes the threshold', () => {
                const threshold = amountIn

                beforeEach('set threshold', async () => {
                  const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
                  await authorizer
                    .connect(owner)
                    .authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
                  await task.connect(owner).setDefaultTokenThreshold({ token: token.address, min: threshold, max: 0 })
                })

                beforeEach('fund smart vault', async () => {
                  await token.mint(smartVault.address, amountIn)
                })

                it('executes the expected connector', async () => {
                  const tx = await task.call(token.address, amountIn, slippage, relayerFee)

                  const connectorData = connector.interface.encodeFunctionData('execute', [
                    chainId,
                    token.address,
                    amountIn,
                    minAmountOut,
                    smartVault.address,
                    relayerFee,
                  ])
                  await assertIndirectEvent(tx, smartVault.interface, 'Executed', {
                    connector,
                    data: connectorData,
                  })

                  await assertIndirectEvent(tx, connector.interface, 'LogExecute', {
                    chainId,
                    token,
                    amountIn,
                    minAmountOut,
                    recipient: smartVault,
                    relayerFee,
                  })
                })

                it('emits an Executed event', async () => {
                  const tx = await task.call(token.address, amountIn, slippage, relayerFee)

                  await assertEvent(tx, 'Executed')
                })
              })

              context('when the current balance does not pass the threshold', () => {
                const threshold = amountIn.add(1)

                beforeEach('set threshold', async () => {
                  const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
                  await authorizer
                    .connect(owner)
                    .authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
                  await task.connect(owner).setDefaultTokenThreshold({ token: token.address, min: threshold, max: 0 })
                })

                it('reverts', async () => {
                  await expect(task.call(token.address, amountIn, slippage, relayerFee)).to.be.revertedWith(
                    'TASK_TOKEN_THRESHOLD_NOT_MET'
                  )
                })
              })
            })

            context('when the given token is not allowed', () => {
              beforeEach('deny token', async () => {
                const setTokensAcceptanceListRole = task.interface.getSighash('setTokensAcceptanceList')
                await authorizer.connect(owner).authorize(owner.address, task.address, setTokensAcceptanceListRole, [])
                await task.connect(owner).setTokensAcceptanceList([token.address], [true])
              })

              it('reverts', async () => {
                await expect(task.call(token.address, amountIn, slippage, relayerFee)).to.be.revertedWith(
                  'TASK_TOKEN_NOT_ALLOWED'
                )
              })
            })
          })

          context('when the destination chain was not set', () => {
            it('reverts', async () => {
              await expect(task.call(token.address, amountIn, slippage, relayerFee)).to.be.revertedWith(
                'TASK_DESTINATION_CHAIN_NOT_SET'
              )
            })
          })
        })

        context('when the amount is zero', () => {
          const amount = 0

          it('reverts', async () => {
            await expect(task.call(token.address, amount, 0, 0)).to.be.revertedWith('TASK_AMOUNT_ZERO')
          })
        })
      })

      context('when the token is the address zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.call(token, 0, 0, 0)).to.be.revertedWith('TASK_TOKEN_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(ZERO_ADDRESS, 0, 0, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
