import { OP } from '@mimic-fi/v3-authorizer'
import {
  assertEvent,
  assertIndirectEvent,
  currentTimestamp,
  deploy,
  deployProxy,
  fp,
  getSigners,
  MAX_UINT256,
  ZERO_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment } from '../../src/setup'
import { itBehavesLikeBaseBridgeTask } from './BaseBridgeTask.behavior'

describe('HopBridger', () => {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, connector: Contract
  let owner: SignerWithAddress, relayer: SignerWithAddress, entrypoint: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner, relayer, entrypoint] = await getSigners(4,))
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  before('deploy connector', async () => {
    connector = await deploy('HopConnectorMock')
    const overrideConnectorCheckRole = smartVault.interface.getSighash('overrideConnectorCheck')
    await authorizer.connect(owner).authorize(owner.address, smartVault.address, overrideConnectorCheckRole, [])
    await smartVault.connect(owner).overrideConnectorCheck(connector.address, true)
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'HopBridger',
      [],
      [
        {
          relayer: relayer.address,
          maxFeePct: fp(0.2),
          maxSlippage: fp(0.1),
          maxDeadline: MAX_UINT256.div(10),
          customMaxFeePcts: [],
          customMaxSlippages: [],
          tokenHopEntrypoints: [],
          baseBridgeConfig: {
            connector: connector.address,
            destinationChain: 0,
            customDestinationChains: [],
            taskConfig: buildEmptyTaskConfig(owner, smartVault),
          },
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

  describe('setRelayer', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setRelayerRole = task.interface.getSighash('setRelayer')
        await authorizer.connect(owner).authorize(owner.address, task.address, setRelayerRole, [])
        task = task.connect(owner)
      })

      it('sets the relayer', async () => {
        await task.setRelayer(relayer.address)

        expect(await task.relayer()).to.be.equal(relayer.address)
      })

      it('emits an event', async () => {
        const tx = await task.setRelayer(relayer.address)

        await assertEvent(tx, 'RelayerSet', { relayer: relayer })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setRelayer(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setMaxDeadline', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setMaxDeadlineRole = task.interface.getSighash('setMaxDeadline')
        await authorizer.connect(owner).authorize(owner.address, task.address, setMaxDeadlineRole, [])
        task = task.connect(owner)
      })

      context('when the deadline is not zero', () => {
        const deadline = 60 * 60

        it('sets the max deadline', async () => {
          await task.setMaxDeadline(deadline)

          expect(await task.maxDeadline()).to.be.equal(deadline)
        })

        it('emits an event', async () => {
          const tx = await task.setMaxDeadline(deadline)

          await assertEvent(tx, 'MaxDeadlineSet', { maxDeadline: deadline })
        })
      })

      context('when the deadline is zero', () => {
        const deadline = 0

        it('reverts', async () => {
          await expect(task.setMaxDeadline(deadline)).to.be.revertedWith('TASK_MAX_DEADLINE_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setMaxDeadline(1)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setDefaultMaxFeePct', () => {
    const maxFeePct = fp(0.5)

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async function () {
        const setDefaultMaxFeePctRole = task.interface.getSighash('setDefaultMaxFeePct')
        await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultMaxFeePctRole, [])
        task = task.connect(owner)
      })

      it('sets the default max fee pct', async function () {
        await task.setDefaultMaxFeePct(maxFeePct)

        expect(await task.defaultMaxFeePct()).to.be.equal(maxFeePct)
      })

      it('emits an event', async function () {
        const tx = await task.setDefaultMaxFeePct(maxFeePct)

        await assertEvent(tx, 'DefaultMaxFeePctSet', { maxFeePct })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(task.setDefaultMaxFeePct(1)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setDefaultMaxSlippage', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async function () {
        const setDefaultMaxSlippageRole = task.interface.getSighash('setDefaultMaxSlippage')
        await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultMaxSlippageRole, [])
        task = task.connect(owner)
      })

      context('when the slippage is not above one', () => {
        const slippage = fp(1)

        it('sets the slippage', async function () {
          await task.setDefaultMaxSlippage(slippage)

          expect(await task.defaultMaxSlippage()).to.be.equal(slippage)
        })

        it('emits an event', async function () {
          const tx = await task.setDefaultMaxSlippage(slippage)

          await assertEvent(tx, 'DefaultMaxSlippageSet', { maxSlippage: slippage })
        })
      })

      context('when the slippage is above one', () => {
        const slippage = fp(1).add(1)

        it('reverts', async function () {
          await expect(task.setDefaultMaxSlippage(slippage)).to.be.revertedWith('TASK_SLIPPAGE_ABOVE_ONE')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(task.setDefaultMaxSlippage(1)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setCustomMaxFeePct', () => {
    const maxFeePct = fp(0.5)
    let token: Contract

    beforeEach('deploy token', async function () {
      token = await deploy('TokenMock', ['TKN'])
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async function () {
        const setCustomMaxFeePctRole = task.interface.getSighash('setCustomMaxFeePct')
        await authorizer.connect(owner).authorize(owner.address, task.address, setCustomMaxFeePctRole, [])
        task = task.connect(owner)
      })

      it('sets the max fee pct', async function () {
        await task.setCustomMaxFeePct(token.address, maxFeePct)

        const customMaxFeePct = await task.getCustomMaxFeePct(token.address)
        expect(customMaxFeePct[0]).to.be.true
        expect(customMaxFeePct[1]).to.be.equal(maxFeePct)
      })

      it('emits an event', async function () {
        const tx = await task.setCustomMaxFeePct(token.address, maxFeePct)

        await assertEvent(tx, 'CustomMaxFeePctSet', { token, maxFeePct })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(task.setCustomMaxFeePct(ZERO_ADDRESS, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setCustomMaxSlippage', () => {
    let token: Contract

    beforeEach('deploy token', async function () {
      token = await deploy('TokenMock', ['TKN'])
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async function () {
        const setCustomMaxSlippageRole = task.interface.getSighash('setCustomMaxSlippage')
        await authorizer.connect(owner).authorize(owner.address, task.address, setCustomMaxSlippageRole, [])
        task = task.connect(owner)
      })

      context('when the slippage is not above one', () => {
        const slippage = fp(1)

        it('sets the slippage', async function () {
          await task.setCustomMaxSlippage(token.address, slippage)

          const customMaxSlippage = await task.getCustomMaxSlippage(token.address)
          expect(customMaxSlippage[0]).to.be.equal(true)
          expect(customMaxSlippage[1]).to.be.equal(slippage)
        })

        it('emits an event', async function () {
          const tx = await task.setCustomMaxSlippage(token.address, slippage)

          await assertEvent(tx, 'CustomMaxSlippageSet', { token, maxSlippage: slippage })
        })
      })

      context('when the slippage is above one', () => {
        const slippage = fp(1).add(1)

        it('reverts', async function () {
          await expect(task.setCustomMaxSlippage(token.address, slippage)).to.be.revertedWith('TASK_SLIPPAGE_ABOVE_ONE')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(task.setCustomMaxSlippage(ZERO_ADDRESS, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setTokenHopEntrypoint', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setTokenHopEntrypointRole = task.interface.getSighash('setTokenHopEntrypoint')
        await authorizer.connect(owner).authorize(owner.address, task.address, setTokenHopEntrypointRole, [])
        task = task.connect(owner)
      })

      context('when the token address is not zero', () => {
        let token: Contract

        beforeEach('deploy token', async () => {
          token = await deploy('TokenMock', ['TKN'])
        })

        context('when setting the Hop entrypoint', () => {
          const itSetsTheHopEntrypoint = () => {
            it('sets the Hop entrypoint', async () => {
              await task.setTokenHopEntrypoint(token.address, entrypoint.address)

              const hopEntrypoint = await task.getTokenHopEntrypoint(token.address)
              expect(hopEntrypoint[0]).to.be.equal(true)
              expect(hopEntrypoint[1]).to.be.equal(entrypoint.address)
            })

            it('emits an event', async () => {
              const tx = await task.setTokenHopEntrypoint(token.address, entrypoint.address)

              await assertEvent(tx, 'TokenHopEntrypointSet', { token, entrypoint })
            })
          }

          context('when the Hop entrypoint was set', () => {
            beforeEach('set Hop entrypoint', async () => {
              await task.setTokenHopEntrypoint(token.address, entrypoint.address)
            })

            itSetsTheHopEntrypoint()
          })

          context('when the Hop entrypoint was not set', () => {
            beforeEach('unset Hop entrypoint', async () => {
              await task.setTokenHopEntrypoint(token.address, ZERO_ADDRESS)
            })

            itSetsTheHopEntrypoint()
          })
        })

        context('when unsetting the Hop entrypoint', () => {
          const entrypoint = ZERO_ADDRESS

          const itUnsetsTheHopEntrypoint = () => {
            it('unsets the Hop entrypoint', async () => {
              await task.setTokenHopEntrypoint(token.address, entrypoint)

              const hopEntrypoint = await task.getTokenHopEntrypoint(token.address)
              expect(hopEntrypoint[0]).to.be.equal(false)
              expect(hopEntrypoint[1]).to.be.equal(entrypoint)
            })

            it('emits an event', async () => {
              const tx = await task.setTokenHopEntrypoint(token.address, entrypoint)

              await assertEvent(tx, 'TokenHopEntrypointSet', { token, entrypoint })
            })
          }

          context('when the Hop entrypoint was set', () => {
            beforeEach('set Hop entrypoint', async () => {
              await task.setTokenHopEntrypoint(token.address, token.address)
            })

            itUnsetsTheHopEntrypoint()
          })

          context('when the token was not set', () => {
            beforeEach('unset Hop entrypoint', async () => {
              await task.setTokenHopEntrypoint(token.address, entrypoint)
            })

            itUnsetsTheHopEntrypoint()
          })
        })
      })

      context('when the token address is zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.setTokenHopEntrypoint(token, ZERO_ADDRESS)).to.be.revertedWith('TASK_HOP_TOKEN_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setTokenHopEntrypoint(ZERO_ADDRESS, ZERO_ADDRESS)).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })

  describe('call', () => {
    beforeEach('authorize task', async () => {
      const executeRole = smartVault.interface.getSighash('execute')
      const params = [{ op: OP.EQ, value: connector.address }]
      await authorizer.connect(owner).authorize(task.address, smartVault.address, executeRole, params)
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
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
          const fee = fp(1)
          const slippage = fp(0.05)

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

                beforeEach('set token hop entrypoint', async () => {
                  const setTokenHopEntrypointRole = task.interface.getSighash('setTokenHopEntrypoint')
                  await authorizer.connect(owner).authorize(owner.address, task.address, setTokenHopEntrypointRole, [])
                  await task.connect(owner).setTokenHopEntrypoint(token.address, entrypoint.address)
                })

                it('executes the expected connector', async () => {
                  const tx = await task.call(token.address, amountIn, slippage, fee)

                  const deadline = (await currentTimestamp()).add(MAX_UINT256.div(10))
                  const minAmountOut = amountIn.mul(fp(1).sub(slippage)).div(fp(1))

                  const connectorData = connector.interface.encodeFunctionData('execute', [
                    chainId,
                    token.address,
                    amountIn,
                    minAmountOut,
                    smartVault.address,
                    entrypoint.address,
                    deadline,
                    relayer.address,
                    fee,
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
                    bridge: entrypoint,
                    deadline,
                    relayer,
                    fee,
                  })
                })

                it('emits an Executed event', async () => {
                  const tx = await task.call(token.address, amountIn, slippage, fee)

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
                  await expect(task.call(token.address, amountIn, slippage, fee)).to.be.revertedWith(
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
                await expect(task.call(token.address, amountIn, slippage, fee)).to.be.revertedWith(
                  'TASK_TOKEN_NOT_ALLOWED'
                )
              })
            })
          })

          context('when the destination chain was not set', () => {
            it('reverts', async () => {
              await expect(task.call(token.address, amountIn, slippage, fee)).to.be.revertedWith(
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
