import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  deployProxy,
  deployTokenMock,
  fp,
  getSigners,
  impersonate,
  instanceAt,
  ONES_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/helpers'
import { OP } from '@mimic-fi/v3-authorizer'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract, ethers } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment } from '../../../src/setup'

/* eslint-disable no-secrets/no-secrets */

const BALANCER_VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'
const POOL_staBAL3 = '0x06Df3b2bbB68adc8B0e302443692037ED9f91b42' // staBAL3
const POOL_BAL_WETH = '0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56' // BAL-WETH 80/20

describe('BalancerV2PoolExiter', function () {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, connector: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  before('deploy connector', async () => {
    connector = await deploy('BalancerV2PoolConnectorMock', [BALANCER_VAULT])
    const overrideConnectorCheckRole = smartVault.interface.getSighash('overrideConnectorCheck')
    await authorizer.connect(owner).authorize(owner.address, smartVault.address, overrideConnectorCheckRole, [])
    await smartVault.connect(owner).overrideConnectorCheck(connector.address, true)
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'BalancerV2PoolExiter',
      [],
      [
        {
          connector: connector.address,
          maxSlippage: 0,
          customMaxSlippages: [],
          taskConfig: buildEmptyTaskConfig(owner, smartVault),
        },
      ]
    )
  })
  describe('execution type', () => {
    it('defines it correctly', async () => {
      const expectedType = ethers.utils.solidityKeccak256(['string'], ['BALANCER_V2_POOL_EXITER'])
      expect(await task.EXECUTION_TYPE()).to.be.equal(expectedType)
    })
  })

  describe('setConnector', () => {
    let connector: Contract

    beforeEach('deploy connector', async () => {
      connector = await deployTokenMock('TKN')
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setConnectorRole = task.interface.getSighash('setConnector')
        await authorizer.connect(owner).authorize(owner.address, task.address, setConnectorRole, [])
        task = task.connect(owner)
      })

      it('sets the connector', async () => {
        await task.setConnector(connector.address)

        expect(await task.connector()).to.be.equal(connector.address)
      })

      it('emits an event', async () => {
        const tx = await task.setConnector(connector.address)

        await assertEvent(tx, 'ConnectorSet', { connector })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setConnector(ZERO_ADDRESS)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('setDefaultMaxSlippage', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setDefaultMaxSlippageRole = task.interface.getSighash('setDefaultMaxSlippage')
        await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultMaxSlippageRole, [])
        task = task.connect(owner)
      })

      context('when the slippage is not above one', () => {
        const slippage = fp(1)

        it('sets the slippage', async () => {
          await task.setDefaultMaxSlippage(slippage)

          expect(await task.defaultMaxSlippage()).to.be.equal(slippage)
        })

        it('emits an event', async () => {
          const tx = await task.setDefaultMaxSlippage(slippage)

          await assertEvent(tx, 'DefaultMaxSlippageSet', { maxSlippage: slippage })
        })
      })

      context('when the slippage is above one', () => {
        const slippage = fp(1).add(1)

        it('reverts', async () => {
          await expect(task.setDefaultMaxSlippage(slippage)).to.be.revertedWith('TaskSlippageAboveOne')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setDefaultMaxSlippage(1)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('setCustomMaxSlippage', () => {
    let token: Contract

    beforeEach('deploy token', async () => {
      token = await deployTokenMock('TKN')
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setCustomMaxSlippageRole = task.interface.getSighash('setCustomMaxSlippage')
        await authorizer.connect(owner).authorize(owner.address, task.address, setCustomMaxSlippageRole, [])
        task = task.connect(owner)
      })

      context('when the slippage is not above one', () => {
        const slippage = fp(1)

        it('sets the slippage', async () => {
          await task.setCustomMaxSlippage(token.address, slippage)

          expect(await task.customMaxSlippage(token.address)).to.be.equal(slippage)
        })

        it('emits an event', async () => {
          const tx = await task.setCustomMaxSlippage(token.address, slippage)

          await assertEvent(tx, 'CustomMaxSlippageSet', { token, maxSlippage: slippage })
        })
      })

      context('when the slippage is above one', () => {
        const slippage = fp(1).add(1)

        it('reverts', async () => {
          await expect(task.setCustomMaxSlippage(token.address, slippage)).to.be.revertedWith('TaskSlippageAboveOne')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setCustomMaxSlippage(ZERO_ADDRESS, 0)).to.be.revertedWith('AuthSenderNotAllowed')
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
      beforeEach('set sender', async () => {
        const callRole = task.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, task.address, callRole, [])
        task = task.connect(owner)
      })

      context('when the token in is not zero', () => {
        let pool: Contract, balancer: Contract

        beforeEach('load balancer', async () => {
          balancer = await instanceAt('IBalancerVault', BALANCER_VAULT)
        })

        context('when the amount in is not zero', () => {
          const amount = fp(5)
          const prevConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000001'
          const nextConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000002'

          const itExitsThePoolProperly = (poolAddress: string, whaleAddress: string) => {
            beforeEach('fund smart vault', async () => {
              pool = await instanceAt('IBalancerPool', poolAddress)
              const whale = await impersonate(whaleAddress, fp(10))
              await pool.connect(whale).transfer(smartVault.address, amount)
            })

            beforeEach('set balance connectors', async () => {
              const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
              await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
              await task.connect(owner).setBalanceConnectors(prevConnectorId, nextConnectorId)
            })

            beforeEach('authorize task to update balance connectors', async () => {
              const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
              await authorizer
                .connect(owner)
                .authorize(task.address, smartVault.address, updateBalanceConnectorRole, [])
            })

            beforeEach('assign amount in to previous balance connector', async () => {
              const updateBalanceConnectorRole = smartVault.interface.getSighash('updateBalanceConnector')
              await authorizer
                .connect(owner)
                .authorize(owner.address, smartVault.address, updateBalanceConnectorRole, [])
              await smartVault.connect(owner).updateBalanceConnector(prevConnectorId, pool.address, amount, true)
            })

            context('when the given slippage does not pass the max slippage', () => {
              const slippage = 0

              it('executes the expected connector', async () => {
                const tx = await task.call(pool.address, 0, slippage)

                const minAmountsOut = []
                const { tokens: tokensOut, balances } = await balancer.getPoolTokens(await pool.getPoolId())

                const bptTotalSupply = await pool.totalSupply()
                const bptRatio = amount.mul(fp(1)).div(bptTotalSupply)
                for (let i = 0; i < tokensOut.length; i++) minAmountsOut[i] = balances[i].mul(bptRatio).div(fp(1))

                const connectorData = connector.interface.encodeFunctionData('exit', [
                  pool.address,
                  amount,
                  tokensOut,
                  minAmountsOut,
                ])

                await assertIndirectEvent(tx, smartVault.interface, 'Executed', {
                  connector,
                  data: connectorData,
                })

                await assertIndirectEvent(tx, connector.interface, 'LogExecute', {
                  tokenIn: pool.address,
                  amountIn: amount,
                  tokensOut,
                  minAmountsOut,
                })
              })

              it('emits an Executed event', async () => {
                const tx = await task.call(pool.address, 0, slippage)

                await assertEvent(tx, 'Executed')
              })

              it('updates the balance connectors properly', async () => {
                const previousConnectorBalance = await smartVault.getBalanceConnector(prevConnectorId, pool.address)

                await task.call(pool.address, 0, slippage)

                const currentConnectorBalance = await smartVault.getBalanceConnector(prevConnectorId, pool.address)
                expect(currentConnectorBalance).to.be.equal(previousConnectorBalance.sub(amount))

                const { tokens: tokensOut } = await balancer.getPoolTokens(await pool.getPoolId())
                for (const tokenAddress of tokensOut) {
                  expect(await smartVault.getBalanceConnector(nextConnectorId, tokenAddress)).to.be.gt(0)
                }
              })
            })

            context('when the given slippage does not pass the max slippage', () => {
              const slippage = fp(0.01)

              it('reverts', async () => {
                await expect(task.call(pool.address, 0, slippage)).to.be.revertedWith('TaskSlippageAboveMax')
              })
            })
          }

          context('weighted pool', () => {
            const WHALE = '0x24faf482304ed21f82c86ed5feb0ea313231a808'

            itExitsThePoolProperly(POOL_BAL_WETH, WHALE)
          })

          context('stable pool', () => {
            const WHALE = '0xb49d12163334f13c2a1619b6b73659fe6e849e30'

            itExitsThePoolProperly(POOL_staBAL3, WHALE)
          })
        })

        context('when the amount in is zero', () => {
          const amount = 0

          it('reverts', async () => {
            await expect(task.call(ONES_ADDRESS, amount, 0)).to.be.revertedWith('TaskAmountZero')
          })
        })
      })

      context('when the token is zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.call(token, 1, 0)).to.be.revertedWith('TaskTokenZero')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(ZERO_ADDRESS, 0, 0)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })
})
