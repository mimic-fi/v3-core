import { OP } from '@mimic-fi/v3-authorizer'
import {
  deploy,
  deployFeedMock,
  deployProxy,
  fp,
  getSigners,
  impersonate,
  instanceAt,
  ZERO_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment } from '../../src/setup'

/* eslint-disable no-secrets/no-secrets */

const BALANCER_VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'
const POOL_bb_a_USD = '0xA13a9247ea42D743238089903570127DdA72fE44' // bb-a-USD
const POOL_bb_a_USDT_bb_a_DAI_bb_a_USDC = '0x7B50775383d3D6f0215A8F290f2C9e2eEBBEceb2' // bb-a-USDT bb-a-DAI bb-a-USDC

describe('BalancerV2BoostedSwapper', function () {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, priceOracle: Contract, connector: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault, priceOracle } = await deployEnvironment(owner))
  })

  before('deploy connector', async () => {
    connector = await deploy(
      '@mimic-fi/v3-connectors/artifacts/contracts/balancer/BalancerV2SwapConnector.sol/BalancerV2SwapConnector',
      [BALANCER_VAULT]
    )
    const overrideConnectorCheckRole = smartVault.interface.getSighash('overrideConnectorCheck')
    await authorizer.connect(owner).authorize(owner.address, smartVault.address, overrideConnectorCheckRole, [])
    await smartVault.connect(owner).overrideConnectorCheck(connector.address, true)
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'BalancerV2BoostedSwapper',
      [],
      [
        {
          baseSwapConfig: {
            connector: connector.address,
            tokenOut: ZERO_ADDRESS,
            maxSlippage: 0,
            customTokensOut: [],
            customMaxSlippages: [],
            taskConfig: buildEmptyTaskConfig(owner, smartVault),
          },
        },
      ]
    )
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
        let pool: Contract, underlyingToken: Contract, balancer: Contract

        const itExitsThePoolProperly = (poolAddress: string, whaleAddress: string) => {
          beforeEach('load pool', async () => {
            pool = await instanceAt('IBalancerBoostedPool', poolAddress)
            balancer = await instanceAt('IBalancerVault', BALANCER_VAULT)

            const bptIndex = await pool.getBptIndex()
            const { tokens } = await balancer.getPoolTokens(await pool.getPoolId())
            underlyingToken = await instanceAt('IERC20', bptIndex.eq(0) ? tokens[1] : tokens[0])
          })

          context('when the amount in is not zero', () => {
            const amount = fp(1)
            const prevConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000001'
            const nextConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000002'

            beforeEach('fund smart vault', async () => {
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

            context('when an oracle is given', () => {
              const rate = fp(1)

              beforeEach('set price feed', async () => {
                const feed = await deployFeedMock(rate, 18)
                const setFeedRole = priceOracle.interface.getSighash('setFeed')
                await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
                await priceOracle.connect(owner).setFeed(pool.address, underlyingToken.address, feed.address)
              })

              context('when the slippage is below the limit', () => {
                const slippage = fp(0.01)

                beforeEach('set max slippage', async () => {
                  const setDefaultMaxSlippageRole = task.interface.getSighash('setDefaultMaxSlippage')
                  await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultMaxSlippageRole, [])
                  await task.connect(owner).setDefaultMaxSlippage(slippage)
                })

                it('swaps for the first underlying token', async () => {
                  const previousBptBalance = await pool.balanceOf(smartVault.address)
                  const previousMainTokenBalance = await underlyingToken.balanceOf(smartVault.address)

                  await task.call(pool.address, 0, slippage)

                  const currentBptBalance = await pool.balanceOf(smartVault.address)
                  expect(currentBptBalance).to.be.equal(previousBptBalance.sub(amount))

                  const currentMainTokenBalance = await underlyingToken.balanceOf(smartVault.address)
                  expect(currentMainTokenBalance).to.be.gt(previousMainTokenBalance)
                })

                it('updates the balance connectors properly', async () => {
                  const previousConnectorBalance = await smartVault.getBalanceConnector(prevConnectorId, pool.address)

                  await task.call(pool.address, 0, slippage)

                  const currentConnectorBalance = await smartVault.getBalanceConnector(prevConnectorId, pool.address)
                  expect(currentConnectorBalance).to.be.equal(previousConnectorBalance.sub(amount))

                  const mainTokenBalance = await underlyingToken.balanceOf(smartVault.address)
                  const nextConnectorBalance = await smartVault.getBalanceConnector(
                    nextConnectorId,
                    underlyingToken.address
                  )
                  expect(nextConnectorBalance).to.be.equal(mainTokenBalance)
                })
              })

              context('when the slippage is above the limit', () => {
                const slippage = fp(0.01)

                it('reverts', async () => {
                  await expect(task.call(pool.address, 0, slippage)).to.be.revertedWith('TaskSlippageAboveMax')
                })
              })
            })

            context('when no oracle is given', () => {
              beforeEach('set price feed', async () => {
                const setFeedRole = priceOracle.interface.getSighash('setFeed')
                await authorizer.connect(owner).authorize(owner.address, priceOracle.address, setFeedRole, [])
                await priceOracle.connect(owner).setFeed(pool.address, underlyingToken.address, ZERO_ADDRESS)
              })

              it('reverts', async () => {
                // TODO: Hardhat does not decode price oracle error properly
                await expect(task.call(pool.address, 0, 0)).to.be.reverted
              })
            })
          })

          context('when the amount in is zero', () => {
            const amount = 0

            it('reverts', async () => {
              await expect(task.call(pool.address, amount, 0)).to.be.revertedWith('TaskAmountZero')
            })
          })
        }

        context('phantom pool', () => {
          const WHALE = '0x575daf04615aef7272b388e3d7fac8adf1974173'

          itExitsThePoolProperly(POOL_bb_a_USDT_bb_a_DAI_bb_a_USDC, WHALE)
        })

        context('composable pool', () => {
          const WHALE = '0x43b650399f2e4d6f03503f44042faba8f7d73470'

          itExitsThePoolProperly(POOL_bb_a_USD, WHALE)
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
