import {
  assertIndirectEvent,
  deployProxy,
  fp,
  getSigners,
  impersonate,
  instanceAt,
  toUSDC,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment } from '../../../dist'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const BALANCER_VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'

describe('BalancerBPTExiter', function () {
  let task: Contract
  let smartVault: Contract, authorizer: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'BalancerBPTExiter',
      [],
      [
        {
          balancerVault: BALANCER_VAULT,
          taskConfig: buildEmptyTaskConfig(owner, smartVault),
        },
      ]
    )
  })

  describe('initialize', () => {
    it('has a reference to the balancer vault', async () => {
      expect(await task.balancerVault()).to.be.equal(BALANCER_VAULT)
    })
  })

  describe('call', () => {
    beforeEach('authorize task', async () => {
      const callRole = smartVault.interface.getSighash('call')
      await authorizer.connect(owner).authorize(task.address, smartVault.address, callRole, [])
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = task.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, task.address, callRole, [])
        task = task.connect(owner)
      })

      context('when the token is not zero', () => {
        const amount = fp(5)
        let pool: Contract, usdc: Contract, balancer: Contract

        beforeEach('load contracts', async () => {
          usdc = await instanceAt('IERC20', USDC)
          balancer = await instanceAt('IBalancerVault', BALANCER_VAULT)
        })

        const setUpPool = (poolContractName: string, poolAddress: string, whaleAddress: string) => {
          beforeEach('load pool', async () => {
            pool = await instanceAt(poolContractName, poolAddress)
            const whale = await impersonate(whaleAddress, fp(10))
            await pool.connect(whale).transfer(smartVault.address, amount)
          })
        }

        context('when the amount is not zero', () => {
          beforeEach('fund smart vault', async () => {
            const whale = await impersonate('0xDa9CE944a37d218c3302F6B82a094844C6ECEb17', fp(10))
            await usdc.connect(whale).transfer(smartVault.address, toUSDC(1000))
          })

          context('when the threshold has passed', () => {
            const threshold = amount

            const setTokenThreshold = () => {
              beforeEach('set default token threshold', async () => {
                const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
                await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
                await task.connect(owner).setDefaultTokenThreshold(pool.address, threshold, 0)
              })
            }

            context('with balance connectors', () => {
              const requestedAmount = 0
              const prevConnectorId = '0x0000000000000000000000000000000000000000000000000000000000000001'

              const setBalanceConnectors = () => {
                beforeEach('set balance connectors', async () => {
                  const setBalanceConnectorsRole = task.interface.getSighash('setBalanceConnectors')
                  await authorizer.connect(owner).authorize(owner.address, task.address, setBalanceConnectorsRole, [])
                  await task.connect(owner).setBalanceConnectors(prevConnectorId, ZERO_BYTES32)
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
              }

              const itUpdatesTheBalanceConnectorsProperly = () => {
                it('updates the balance connectors properly', async () => {
                  const tx = await task.call(pool.address, requestedAmount)

                  await assertIndirectEvent(tx, smartVault.interface, 'BalanceConnectorUpdated', {
                    id: prevConnectorId,
                    token: pool.address,
                    amount,
                    added: false,
                  })
                })
              }

              context('normal pools', () => {
                const itExitsProportionally = () => {
                  const getTokenBalances = async (tokens: string[], account: Contract): Promise<BigNumber[]> => {
                    return Promise.all(
                      tokens.map(async (tokenAddress: string) => {
                        const token = await instanceAt('IERC20', tokenAddress)
                        return token.balanceOf(account.address)
                      })
                    )
                  }

                  it('exits the BPT proportionally', async () => {
                    const { tokens } = await balancer.getPoolTokens(await pool.getPoolId())
                    const previousTokenBalances = await getTokenBalances(tokens, smartVault)
                    const previousBptBalance = await pool.balanceOf(smartVault.address)

                    await task.call(pool.address, requestedAmount)

                    const currentTokenBalances = await getTokenBalances(tokens, smartVault)
                    currentTokenBalances.forEach((currentBalance, i) =>
                      expect(currentBalance).to.be.gt(previousTokenBalances[i])
                    )

                    const currentBptBalance = await pool.balanceOf(smartVault.address)
                    expect(currentBptBalance).to.be.equal(previousBptBalance.sub(amount))
                  })
                }

                context('weighted pool', () => {
                  const POOL = '0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56' // BAL-WETH 80/20
                  const WHALE = '0x24faf482304ed21f82c86ed5feb0ea313231a808'

                  setUpPool('IBalancerPool', POOL, WHALE)
                  setTokenThreshold()
                  setBalanceConnectors()

                  itExitsProportionally()
                  itUpdatesTheBalanceConnectorsProperly()
                })

                context('stable pool', () => {
                  const POOL = '0x06Df3b2bbB68adc8B0e302443692037ED9f91b42' // staBAL3
                  const WHALE = '0xb49d12163334f13c2a1619b6b73659fe6e849e30'

                  setUpPool('IBalancerPool', POOL, WHALE)
                  setTokenThreshold()
                  setBalanceConnectors()

                  itExitsProportionally()
                  itUpdatesTheBalanceConnectorsProperly()
                })
              })

              context('boosted pools', () => {
                const itSwapsForTheFirstUnderlyingToken = () => {
                  it('swaps to the first underlying token', async () => {
                    const bptIndex = await pool.getBptIndex()
                    const { tokens } = await balancer.getPoolTokens(await pool.getPoolId())
                    const underlying = await instanceAt('IBalancerBoostedPool', tokens[bptIndex.eq(0) ? 1 : 0])

                    const previousBptBalance = await pool.balanceOf(smartVault.address)
                    const previousUnderlyingBalance = await underlying.balanceOf(smartVault.address)

                    await task.call(pool.address, requestedAmount)

                    const currentBptBalance = await pool.balanceOf(smartVault.address)
                    expect(currentBptBalance).to.be.equal(previousBptBalance.sub(amount))

                    const currentUnderlyingBalance = await underlying.balanceOf(smartVault.address)
                    expect(currentUnderlyingBalance).to.be.gt(previousUnderlyingBalance)
                  })
                }

                context('linear pool', () => {
                  const POOL = '0x2BBf681cC4eb09218BEe85EA2a5d3D13Fa40fC0C' // bb-a-USDT
                  const WHALE = '0xc578d755cd56255d3ff6e92e1b6371ba945e3984'

                  setUpPool('IBalancerLinearPool', POOL, WHALE)
                  setTokenThreshold()
                  setBalanceConnectors()

                  it('swaps for the first main token', async () => {
                    const mainToken = await instanceAt('IERC20', pool.getMainToken())

                    const previousBptBalance = await pool.balanceOf(smartVault.address)
                    const previousMainTokenBalance = await mainToken.balanceOf(smartVault.address)

                    await task.call(pool.address, requestedAmount)

                    const currentBptBalance = await pool.balanceOf(smartVault.address)
                    expect(currentBptBalance).to.be.equal(previousBptBalance.sub(amount))

                    const currentMainTokenBalance = await mainToken.balanceOf(smartVault.address)
                    expect(currentMainTokenBalance).to.be.gt(previousMainTokenBalance)
                  })

                  itUpdatesTheBalanceConnectorsProperly()
                })

                context('phantom pool', () => {
                  const POOL = '0x7B50775383d3D6f0215A8F290f2C9e2eEBBEceb2' // bb-a-USDT bb-a-DAI bb-a-USDC
                  const WHALE = '0x575daf04615aef7272b388e3d7fac8adf1974173'

                  setUpPool('IBalancerBoostedPool', POOL, WHALE)
                  setTokenThreshold()
                  setBalanceConnectors()

                  itSwapsForTheFirstUnderlyingToken()
                  itUpdatesTheBalanceConnectorsProperly()
                })

                context('composable pool', () => {
                  const POOL = '0xA13a9247ea42D743238089903570127DdA72fE44' // bb-a-USD
                  const WHALE = '0x43b650399f2e4d6f03503f44042faba8f7d73470'

                  setUpPool('IBalancerBoostedPool', POOL, WHALE)
                  setTokenThreshold()
                  setBalanceConnectors()

                  itSwapsForTheFirstUnderlyingToken()
                  itUpdatesTheBalanceConnectorsProperly()
                })
              })
            })
          })

          context('when the threshold has not passed', () => {
            const threshold = amount.add(1)

            beforeEach('set token threshold', async () => {
              const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
              await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
              await task.connect(owner).setDefaultTokenThreshold(pool.address, threshold, 0)
            })

            it('reverts', async () => {
              await expect(task.call(pool.address, amount)).to.be.revertedWith('TaskTokenThresholdNotMet')
            })
          })
        })

        context('when the amount is zero', () => {
          const amount = 0

          it('reverts', async () => {
            await expect(task.call(pool.address, amount)).to.be.revertedWith('TaskAmountZero')
          })
        })
      })

      context('when the token is zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(task.call(token, 0)).to.be.revertedWith('TaskTokenZero')
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
